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

// 用解析出的意图查 Supabase 拉候选
async function fetchCandidates(intent: Awaited<ReturnType<typeof parseIntent>>): Promise<Destination[]> {
  let q = supabase
    .from('destinations')
    .select(SELECT_COLS)
    .eq('city', intent.city);

  if (intent.categories.length > 0) {
    q = q.in('main_category', intent.categories);
  }
  if (intent.childFriendly === true) {
    q = q.eq('child_friendly', true);
  }
  if (intent.outdoor === true) {
    q = q.in('indoor_outdoor', ['outdoor', 'both']);
  }
  // 关键词：取第一个做 name ilike（多关键词 ilike 一般召回少，先简单做）
  const kw = intent.keywords[0]?.trim();
  if (kw) {
    q = q.ilike('name', `%${kw.replace(/[,()]/g, ' ')}%`);
  }

  // 拉得比 maxResults 多一些，让 AI 精排有挑选空间
  q = q.limit(Math.max(intent.maxResults * 1.5, 20));
  const { data, error } = await q;
  if (error) throw error;
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
        // ===== 1. 意图解析 =====
        const intent = await parseIntent(query, mockProfile);
        if (cancelled) return;
        setState((s) => ({ ...s, stage: 'querying' }));

        // ===== 2. 查 Supabase 拿候选 =====
        let candidates = await fetchCandidates(intent);
        if (cancelled) return;

        // 候选为空时放宽：去掉 category/child/outdoor 限制再来一次
        if (candidates.length === 0) {
          candidates = await fetchCandidates({
            ...intent,
            categories: [],
            childFriendly: undefined,
            outdoor: undefined,
          });
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
