import { useEffect, useState } from 'react';
import { searchDestinations, searchByDistance, HOME_COORDS } from '../lib/api';
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

type Intent = Awaited<ReturnType<typeof parseIntent>>;

interface FetchOpts {
  applyCategories?: boolean;     // false 时跳过 main_category 限制
  applyKeyword?: boolean;        // false 时跳过 name/description 关键词
  applyChildOutdoor?: boolean;   // false 时跳过 child_friendly + outdoor
  expandRadius?: boolean;        // true 时把半径放大到 200km（一级放宽用）
}

// 用解析出的意图调 PostGIS RPC，按距离排序拿候选
async function fetchCandidates(
  intent: Intent,
  opts: FetchOpts = {},
): Promise<Destination[]> {
  const applyCategories = opts.applyCategories ?? true;
  const applyKeyword = opts.applyKeyword ?? true;
  const applyChildOutdoor = opts.applyChildOutdoor ?? true;

  const lat = intent.nearLat ?? HOME_COORDS.lat;
  const lng = intent.nearLng ?? HOME_COORDS.lng;
  const km = opts.expandRadius ? 200 : (intent.maxDistanceKm ?? 60);
  // 拉得比 maxResults 多一些，给 AI 精排留挑选空间。limit 必须是整数
  const limit = Math.max(Math.round(intent.maxResults * 1.5), 30);

  // 关键词：当前 RPC 只支持单 keyword 模糊；多关键词时取首个最长的
  const kw = applyKeyword
    ? intent.keywords
        .map((k) => k.trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0]
    : undefined;

  // RPC 实际入参：和 supabase.rpc('search_nearby', {...}) 真正传过去的对齐，便于在浏览器对照
  const rpcArgs = {
    user_lat: lat,
    user_lng: lng,
    max_distance_meters: km * 1000,
    category_filter:
      applyCategories && intent.categories.length > 0 ? intent.categories : null,
    child_friendly_filter:
      applyChildOutdoor && typeof intent.childFriendly === 'boolean'
        ? intent.childFriendly
        : null,
    outdoor_filter:
      applyChildOutdoor && typeof intent.outdoor === 'boolean'
        ? intent.outdoor
        : null,
    keyword: kw ?? null,
    result_limit: limit,
  };

  console.log('[useSearchResults] fetchCandidates 开关:', {
    applyCategories,
    applyKeyword,
    applyChildOutdoor,
    expandRadius: !!opts.expandRadius,
    km,
  });
  console.log('[useSearchResults] → search_nearby RPC 入参:', rpcArgs);

  const rows = await searchByDistance({
    lat,
    lng,
    maxDistanceMeters: km * 1000,
    categories: applyCategories ? intent.categories : undefined,
    childFriendly: applyChildOutdoor ? intent.childFriendly : undefined,
    outdoor: applyChildOutdoor ? intent.outdoor : undefined,
    keyword: kw,
    limit,
  });
  console.log(`[useSearchResults] ← RPC 返回候选 ${rows.length} 条`);
  if (rows.length > 0) {
    console.log(
      '[useSearchResults]   候选样本(前5):',
      rows.slice(0, 5).map((r) => ({
        name: r.name,
        cat: r.main_category,
        child: r.child_friendly,
        km:
          typeof r.distance_meters === 'number'
            ? Math.round((r.distance_meters / 1000) * 10) / 10
            : null,
      })),
    );
  }
  return rows;
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
        console.log('[useSearchResults] 意图解析结果(完整 intent):', intent);
        console.log(
          `[useSearchResults]   摘要: 类目=[${intent.categories.join(',') || '空'}], ` +
            `childFriendly=${intent.childFriendly}, outdoor=${intent.outdoor}, ` +
            `keywords=[${intent.keywords.join(',') || '空'}], ` +
            `near=(${intent.nearLat},${intent.nearLng})/${intent.nearName ?? '?'}, ` +
            `maxDistanceKm=${intent.maxDistanceKm}, maxResults=${intent.maxResults}`,
        );
        if (cancelled) return;
        setState((s) => ({ ...s, stage: 'querying' }));

        // ===== 2. 调 PostGIS RPC 按距离拿候选 =====
        let candidates = await fetchCandidates(intent);
        if (cancelled) return;

        // 一级放宽：候选 < 10 时去掉分类 + 关键词 + childFriendly/outdoor 限制
        // （只靠距离来筛——数据库里大量 POI 的 child_friendly 是 null，过严会大量误杀）
        if (candidates.length < 10) {
          console.log(
            `[useSearchResults] 候选只有 ${candidates.length} 条，一级放宽：去掉分类/关键词/亲子限制，仅按距离重查`,
          );
          const broader = await fetchCandidates(intent, {
            applyCategories: false,
            applyKeyword: false,
            applyChildOutdoor: false,
          });
          if (cancelled) return;
          // 用 id 去重合并，原候选优先（保留 distance_meters 排序）
          const seen = new Set(candidates.map((c) => c.id));
          for (const c of broader) {
            if (!seen.has(c.id)) {
              candidates.push(c);
              seen.add(c.id);
            }
          }
          console.log(
            `[useSearchResults] 一级放宽后合并候选 ${candidates.length} 条`,
          );
        }

        // 二级放宽：仍 0 条 → 把半径扩到 200km，所有条件全去掉
        if (candidates.length === 0) {
          console.log('[useSearchResults] 仍 0 条，二级放宽：扩大半径到 200km');
          candidates = await fetchCandidates(intent, {
            applyCategories: false,
            applyKeyword: false,
            applyChildOutdoor: false,
            expandRadius: true,
          });
        }
        if (cancelled) return;

        if (candidates.length === 0) {
          setState({ data: [], stage: 'empty', error: null, fallback: false });
          return;
        }
        setState((s) => ({ ...s, stage: 'ranking' }));

        // ===== 3. AI 精排 + 推荐理由 =====
        console.log(
          `[useSearchResults] → rankAndExplain 输入候选 ${candidates.length} 条`,
        );
        let rankings: Awaited<ReturnType<typeof rankAndExplain>> = [];
        try {
          rankings = await rankAndExplain(candidates, query, mockProfile);
        } catch (e) {
          // 精排失败不致命，直接用候选顺序展示
          console.warn('[ai rank failed]', e);
        }
        if (cancelled) return;
        console.log(
          `[useSearchResults] ← rankAndExplain 返回精排 ${rankings.length} 条`,
        );

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
        console.log(
          `[useSearchResults] ===== 流程结束: 候选 ${candidates.length} → 精排 ${rankings.length} → 展示 ${ordered.length} (maxResults=${intent.maxResults})`,
        );

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
