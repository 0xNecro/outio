import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { searchDestinations } from '../lib/api';
import { parseIntent, rankAndExplain, AiError } from '../lib/ai';
import { mockProfile } from '../lib/mock';
import { enrichForView } from '../lib/view';
import type { Destination } from '../lib/types';

export type SearchStage = 'parsing' | 'querying' | 'ranking' | 'done' | 'error' | 'empty';

interface State {
  data: Destination[];
  stage: SearchStage;
  error: string | null;
  fallback: boolean; // true 表示走了简单搜索 fallback
}

const SELECT_COLS = [
  'id', 'source_id', 'name',
  'country', 'province', 'city', 'district', 'address',
  'main_category', 'sub_category', 'detail_type', 'tags',
  'suitable_for', 'child_friendly', 'min_age', 'max_age', 'best_season', 'indoor_outdoor',
  'description', 'tips', 'ticket_price', 'rating',
  'has_parking', 'has_ev_charging', 'stroller_ok', 'wheelchair_ok',
  'phone', 'website', 'data_source', 'confidence',
].join(',');

type Intent = Awaited<ReturnType<typeof parseIntent>>;

// PostgREST or() value 里的 ',' '(' ')' 是分隔符，必须剔除避免破坏语法
function sanitizeKw(s: string): string {
  return s.trim().replace(/[,()*%]/g, ' ');
}

interface FetchOpts {
  applyCategories?: boolean; // 默认 true；false 时跳过 main_category 限制
}

// 用解析出的意图查 Supabase 拉候选
async function fetchCandidates(
  intent: Intent,
  opts: FetchOpts = {},
): Promise<Destination[]> {
  const applyCategories = opts.applyCategories ?? true;

  let q = supabase
    .from('destinations')
    .select(SELECT_COLS)
    .eq('city', intent.city);

  if (applyCategories && intent.categories.length > 0) {
    q = q.in('main_category', intent.categories);
  }
  if (intent.childFriendly === true) {
    q = q.eq('child_friendly', true);
  }
  if (intent.outdoor === true) {
    q = q.in('indoor_outdoor', ['outdoor', 'both']);
  }

  // 关键词：多关键词 OR 匹配（name 或 description 命中任意一个即可）
  const kws = intent.keywords.map(sanitizeKw).filter(Boolean).slice(0, 2);
  if (kws.length > 0) {
    const orParts = kws.flatMap((k) => [
      `name.ilike.%${k}%`,
      `description.ilike.%${k}%`,
    ]);
    q = q.or(orParts.join(','));
  }

  // 拉得比 maxResults 多一些，给 AI 精排留挑选空间。limit 必须是整数
  const limit = Math.max(Math.round(intent.maxResults * 1.5), 30);
  q = q.limit(limit);
  console.log('[useSearchResults] fetchCandidates', {
    intent,
    applyCategories,
    keywords: kws,
    limit,
  });
  const { data, error } = await q;
  if (error) {
    console.error('[useSearchResults] Supabase 查询出错:', error);
    throw error;
  }
  console.log('[useSearchResults] Supabase 返回行数:', data?.length ?? 0);
  return (data ?? []) as unknown as Destination[];
}

export function useSearchResults(query: string): State {
  const [state, setState] = useState<State>({
    data: [],
    stage: 'parsing',
    error: null,
    fallback: false,
  });

  useEffect(() => {
    if (!query.trim()) {
      setState({ data: [], stage: 'empty', error: null, fallback: false });
      return;
    }

    let cancelled = false;
    setState({ data: [], stage: 'parsing', error: null, fallback: false });

    (async () => {
      try {
        console.log('[useSearchResults] ===== 开始 AI 搜索流程，query =', query);
        // ===== 1. 意图解析 =====
        const intent = await parseIntent(query, mockProfile);
        console.log('[useSearchResults] 意图解析结果:', intent);
        if (cancelled) return;
        setState((s) => ({ ...s, stage: 'querying' }));

        // ===== 2. 查 Supabase 拿候选 =====
        let candidates = await fetchCandidates(intent);
        if (cancelled) return;

        // 一级放宽：候选 < 10 时去掉分类限制（保留 keywords / child / outdoor）
        if (candidates.length < 10) {
          console.log(
            `[useSearchResults] 候选只有 ${candidates.length} 条，放宽分类限制重试`,
          );
          const broader = await fetchCandidates(intent, { applyCategories: false });
          if (cancelled) return;
          // 用 id 去重合并，原候选优先
          const seen = new Set(candidates.map((c) => c.id));
          for (const c of broader) {
            if (!seen.has(c.id)) {
              candidates.push(c);
              seen.add(c.id);
            }
          }
        }

        // 二级放宽：还是 0 条 → 把 keywords / child / outdoor 也去掉，只按 city 拉
        if (candidates.length === 0) {
          console.log('[useSearchResults] 仍 0 条，去掉所有条件按城市拉');
          candidates = await fetchCandidates(
            {
              ...intent,
              categories: [],
              keywords: [],
              childFriendly: undefined,
              outdoor: undefined,
            },
            { applyCategories: false },
          );
        }
        if (cancelled) return;

        if (candidates.length === 0) {
          setState({ data: [], stage: 'empty', error: null, fallback: false });
          return;
        }
        setState((s) => ({ ...s, stage: 'ranking' }));

        // ===== 3. AI 精排 + 推荐理由 =====
        let rankings: Awaited<ReturnType<typeof rankAndExplain>> = [];
        try {
          rankings = await rankAndExplain(candidates, query, mockProfile);
        } catch (e) {
          // 精排失败不致命，直接用候选顺序展示
          console.warn('[ai rank failed]', e);
        }
        if (cancelled) return;

        // ===== 4. 合并：rankings 顺序优先，没被 LLM 排到的接在后面 =====
        const reasonMap = new Map(rankings.map((r) => [r.id, r.reason]));
        const ranked = rankings
          .map((r) => candidates.find((c) => c.id === r.id))
          .filter((c): c is Destination => !!c);
        const rest = candidates.filter((c) => !reasonMap.has(c.id));
        const ordered = [...ranked, ...rest]
          .slice(0, intent.maxResults)
          .map((d) => {
            const enriched = enrichForView(d);
            const reason = reasonMap.get(d.id);
            return reason ? { ...enriched, ai_reason: reason } : enriched;
          });

        setState({ data: ordered, stage: 'done', error: null, fallback: false });
      } catch (err) {
        if (cancelled) return;
        console.warn('[ai search failed, fallback]', err);
        // ===== Fallback：用旧的简单 name ilike 搜 =====
        try {
          const rows = await searchDestinations(query, 10);
          if (cancelled) return;
          const enriched = rows.map(enrichForView);
          setState({
            data: enriched,
            stage: enriched.length === 0 ? 'empty' : 'done',
            error: null,
            fallback: true,
          });
        } catch (fallbackErr) {
          if (cancelled) return;
          const msg =
            err instanceof AiError
              ? `AI 服务出错（${err.stage}）：${err.message}`
              : err instanceof Error
                ? err.message
                : String(err);
          setState({
            data: [],
            stage: 'error',
            error: msg,
            fallback: false,
          });
          // 把 fallback 异常吞掉，主错误已经报告
          void fallbackErr;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return state;
}
