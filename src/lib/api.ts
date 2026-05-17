import { supabase } from './supabase';
import type { Destination } from './types';

// 默认查询所在城市（Phase 1 京津冀，主要数据集中在北京）
export const DEFAULT_CITY = '北京市';
const DEFAULT_LIMIT = 20;

// 用户家坐标：顺义后沙峪（WGS84）。Phase 2 接入 user_profiles 后从 DB 读
export const HOME_COORDS = { lat: 40.086, lng: 116.537 } as const;

// 默认最大距离（米）。60km 大致覆盖北京六环 + 周边大部分郊区景点
export const DEFAULT_MAX_DISTANCE_METERS = 60_000;

// 字段白名单：location 是 PostGIS WKB 二进制，前端不渲染就不查，省带宽
const SELECT_COLS = [
  'id', 'source_id', 'name',
  'country', 'province', 'city', 'district', 'address',
  'main_category', 'sub_category', 'detail_type', 'tags',
  'suitable_for', 'child_friendly', 'min_age', 'max_age', 'best_season', 'indoor_outdoor',
  'description', 'tips', 'ticket_price', 'rating',
  'has_parking', 'has_ev_charging', 'stroller_ok', 'wheelchair_ok',
  'phone', 'website', 'data_source', 'confidence',
].join(',');

// 类目配额：每类目独立查询，按权重排前。N 个并发拉取后合并到客户端排序。
// 单个 .in() 查询会被 sequential scan 在表前段截断（实测 80 条 candidate 全是"公园"），
// 拆成独立 query + 各自 limit 才能保证类目均衡。
const TIERED_CATEGORIES = [
  { cat: '景区',     take: 8, weight: 100 },
  { cat: '公园',     take: 5, weight: 90 },
  { cat: '博物馆',   take: 3, weight: 80 },
  { cat: '游乐场',   take: 3, weight: 70 },
  { cat: '寺庙宗教', take: 2, weight: 60 },
  { cat: '科技馆',   take: 1, weight: 55 },
  { cat: '美术馆',   take: 1, weight: 50 },
  { cat: '展览馆',   take: 1, weight: 45 },
  { cat: '天文馆',   take: 1, weight: 40 },
  { cat: '采摘园',   take: 2, weight: 35 },
  { cat: '度假村',   take: 1, weight: 30 },
  { cat: '露营地',   take: 2, weight: 25 },
  { cat: '水上活动', take: 1, weight: 20 },
  { cat: '温泉洗浴', take: 1, weight: 15 },
  { cat: '垂钓园',   take: 1, weight: 10 },
] as const;

const CATEGORY_WEIGHT: Record<string, number> = Object.fromEntries(
  TIERED_CATEGORIES.map((t) => [t.cat, t.weight]),
);

// 排序得分：有 description 大幅加权（保证首屏先出有内容的），其次类目权重
function rankDestination(d: Destination): number {
  const descBonus = d.description ? 1000 : 0;
  const catWeight = CATEGORY_WEIGHT[d.main_category] ?? 0;
  return descBonus + catWeight;
}

// 首页快捷标签（顺序即 UI 顺序）。"周末" 暂等同默认列表，"1h 车程内" 待 PostGIS 接入
export const QUICK_TAGS = [
  '亲子',
  '周末',
  '免费',
  '有山有水',
  '1h 车程内',
  '室外',
] as const;
export type QuickTag = (typeof QUICK_TAGS)[number];

// 这些标签当前仅 UI 选中态有效，后端没条件可加
export const TODO_TAGS: readonly QuickTag[] = ['周末', '1h 车程内'];

// PostgREST or() 的 value 里 ',' '(' ')' 是分隔符，必须把用户输入里的它们去掉
function safeIlikeValue(s: string): string {
  return s.trim().replace(/[,()]/g, ' ');
}

// PostgrestFilterBuilder 类型从 supabase-js 拿；这里用 any 避免泛型噪音
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any;

// 把快捷标签 + 搜索词翻译为查询条件，所有类目分查询共用
function applyFilters(
  q: Q,
  filters: readonly QuickTag[],
  search?: string,
): Q {
  for (const f of filters) {
    switch (f) {
      case '亲子':
        // suitable_for 数组含 '亲子' 且 child_friendly = true
        q = q.contains('suitable_for', ['亲子']).eq('child_friendly', true);
        break;
      case '免费':
        // 高德源没填 ticket_price，主要靠 description 关键字 + tags 数组
        q = q.or('description.ilike.*免费*,tags.cs.{免费}');
        break;
      case '有山有水':
        // description 必含 '山'，且 ('水' OR '湖' OR '河') 任一
        q = q
          .ilike('description', '%山%')
          .or('description.ilike.*水*,description.ilike.*湖*,description.ilike.*河*');
        break;
      case '室外':
        q = q.in('indoor_outdoor', ['outdoor', 'both']);
        break;
      case '周末':
      case '1h 车程内':
        // 占位：周末等同默认；1h 车程内待 PostGIS 距离接入
        break;
    }
  }
  if (search) {
    q = q.ilike('name', `%${safeIlikeValue(search)}%`);
  }
  return q;
}

interface ListOpts {
  city?: string;
  filters?: readonly QuickTag[];
  search?: string; // 名称模糊搜索（仅 name ilike）
  limit?: number;
}

export async function listDestinations(opts: ListOpts = {}): Promise<Destination[]> {
  const city = opts.city ?? DEFAULT_CITY;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const filters = opts.filters ?? [];
  const search = opts.search?.trim();

  // 每个类目独立 query，并发执行；带 limit → PostgreSQL 找到 N 条匹配即停，无需索引也快
  const queries = TIERED_CATEGORIES.map(({ cat, take }) => {
    const q = supabase
      .from('destinations')
      .select(SELECT_COLS)
      .eq('city', city)
      .eq('main_category', cat)
      .limit(take);
    return applyFilters(q, filters, search);
  });

  const results = await Promise.all(queries);
  const firstError = results.find((r) => r.error);
  if (firstError?.error) throw firstError.error;

  const merged = results.flatMap((r) => r.data ?? []) as unknown as Destination[];
  merged.sort((a, b) => rankDestination(b) - rankDestination(a));
  return merged.slice(0, limit);
}

export async function getDestination(id: string): Promise<Destination | null> {
  const { data, error } = await supabase
    .from('destinations')
    .select(SELECT_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Destination | null) ?? null;
}

interface NearbyOpts {
  lat?: number;
  lng?: number;
  maxDistanceMeters?: number;
  categories?: string[];
  childFriendly?: boolean;
  outdoor?: boolean;
  keyword?: string;
  limit?: number;
}

// 调 PostGIS RPC 按距离排序。默认以家坐标为中心、60km 内、按距离从近到远
export async function searchByDistance(opts: NearbyOpts = {}): Promise<Destination[]> {
  const lat = opts.lat ?? HOME_COORDS.lat;
  const lng = opts.lng ?? HOME_COORDS.lng;
  const maxDist = opts.maxDistanceMeters ?? DEFAULT_MAX_DISTANCE_METERS;
  const limit = opts.limit ?? DEFAULT_LIMIT;

  const { data, error } = await supabase.rpc('search_nearby', {
    user_lat: lat,
    user_lng: lng,
    max_distance_meters: maxDist,
    category_filter: opts.categories && opts.categories.length > 0 ? opts.categories : null,
    child_friendly_filter: typeof opts.childFriendly === 'boolean' ? opts.childFriendly : null,
    outdoor_filter: typeof opts.outdoor === 'boolean' ? opts.outdoor : null,
    keyword: opts.keyword?.trim() ? safeIlikeValue(opts.keyword) : null,
    result_limit: limit,
  });
  if (error) {
    console.error('[api.searchByDistance] RPC 出错:', error);
    throw error;
  }
  return (data ?? []) as unknown as Destination[];
}

// SearchResults 页用：全表 name 模糊匹配（不限制分类、不要求 description 非空）
export async function searchDestinations(
  query: string,
  limit = 10,
): Promise<Destination[]> {
  const q = safeIlikeValue(query);
  if (!q) return [];
  const { data, error } = await supabase
    .from('destinations')
    .select(SELECT_COLS)
    .ilike('name', `%${q}%`)
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as Destination[];
}
