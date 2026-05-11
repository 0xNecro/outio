// DeepSeek AI 调用：意图解析 + 候选精排（MVP 前端直调）
// 后续迁到服务端 Edge Function，避免 key 暴露
import type { Destination, UserProfile } from './types';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

// 与 destinations 表 main_category 取值对齐（含 31w POI 中出现过的扩展类目）
const ALLOWED_CATEGORIES = [
  '景区', '公园', '博物馆', '游乐场', '采摘园',
  '度假村', '露营地', '寺庙宗教', '垂钓园', '美术馆',
  '展览馆', '科技馆', '天文馆', '水上活动', '温泉洗浴',
  '亲子活动', '亲子服务', '休闲娱乐', '文化场所', '运动场馆',
  '商业街区', '酒店', '剧场演出', '图书馆', '其他',
] as const;

export interface ParsedIntent {
  categories: string[];
  city: string;
  keywords: string[];
  childFriendly?: boolean;
  outdoor?: boolean;
  season?: string;
  maxResults: number;
}

export interface AiRanking {
  id: string;
  reason: string;
}

export class AiError extends Error {
  readonly stage: 'parse' | 'rank' | 'config';
  constructor(message: string, stage: 'parse' | 'rank' | 'config') {
    super(message);
    this.name = 'AiError';
    this.stage = stage;
  }
}

function getApiKey(): string {
  const key = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (!key || !key.trim()) {
    throw new AiError('VITE_DEEPSEEK_API_KEY 未配置', 'config');
  }
  return key.trim();
}

// 把用户画像精简成 LLM 易读的一段中文。原始 UserProfile 信息冗余，给模型反而干扰
function profileBrief(p: UserProfile): string {
  const lines: string[] = [];
  lines.push(`常驻：${p.home_city} ${p.home_address}`);
  if (p.family_members?.length) {
    const fams = p.family_members.map((m) => {
      const age = m.birth_date
        ? ` ${calcAgeDesc(m.birth_date)}`
        : '';
      const mob = m.mobility === 'limited' ? '（行动不便）' : '';
      return `${m.name}(${roleZh(m.role)}${age})${mob}`;
    });
    lines.push(`家庭成员：${fams.join('、')}`);
  }
  const pref = p.preferences;
  if (pref) {
    const bits: string[] = [];
    bits.push(`可接受车程 ${pref.max_drive_minutes} 分钟`);
    if (pref.prefers_outdoor) bits.push('偏好户外');
    if (pref.car_type === 'electric') bits.push('纯电车型（关注充电桩）');
    if (pref.avoids?.length) bits.push(`避免：${pref.avoids.join('、')}`);
    lines.push(`偏好：${bits.join('、')}`);
  }
  return lines.join('\n');
}

function roleZh(r: string): string {
  return { parent: '家长', child: '孩子', grandparent: '老人', partner: '伴侣' }[r] ?? r;
}

function calcAgeDesc(birth: string): string {
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const months =
    (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (months < 24) return `${months}个月`;
  return `${Math.floor(months / 12)}岁`;
}

async function callDeepSeek(
  tag: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; jsonMode?: boolean } = {},
): Promise<string> {
  const key = getApiKey();
  const body: Record<string, unknown> = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: opts.temperature ?? 0.3,
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  console.group(`[ai ${tag}] DeepSeek 请求`);
  console.log('system prompt:\n', systemPrompt);
  console.log('user prompt:\n', userPrompt);
  console.log('body:', body);
  console.groupEnd();

  let resp: Response;
  try {
    resp = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error(`[ai ${tag}] fetch 抛错（网络/CORS）:`, e);
    throw e;
  }

  // 始终用 text() 拿原始响应，自己 parse，方便看真实内容
  const rawBody = await resp.text();
  console.log(`[ai ${tag}] HTTP ${resp.status}, raw body length=${rawBody.length}`);
  console.log(`[ai ${tag}] raw response body:\n`, rawBody);

  if (!resp.ok) {
    throw new Error(`DeepSeek ${resp.status}: ${rawBody.slice(0, 300)}`);
  }

  let envelope: { choices?: Array<{ message?: { content?: unknown } }> };
  try {
    envelope = JSON.parse(rawBody);
  } catch (e) {
    console.error(`[ai ${tag}] 外层响应不是合法 JSON:`, e);
    throw new Error(
      `DeepSeek 响应非 JSON：${rawBody.slice(0, 200)}`,
    );
  }
  console.log(`[ai ${tag}] parsed envelope:`, envelope);

  const content = envelope.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    console.error(`[ai ${tag}] choices[0].message.content 不是非空字符串：`, content);
    throw new Error('DeepSeek 返回空内容');
  }
  console.log(`[ai ${tag}] content string:\n`, content);
  return content;
}

// 模型可能返回：
//   - 纯 JSON
//   - ```json\n{...}\n```（markdown 围栏）
//   - 解释文字 + JSON 在中间
// 全部要兜底
function stripMarkdownFence(s: string): string {
  let t = s.trim();
  // 去 BOM
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  // ```json ... ``` 或 ``` ... ```
  const fence = t.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```$/);
  if (fence) return fence[1].trim();
  return t;
}

function extractJson(tag: string, s: string): unknown {
  const cleaned = stripMarkdownFence(s);
  console.log(`[ai ${tag}] cleaned (markdown stripped):\n`, cleaned);

  try {
    const parsed = JSON.parse(cleaned);
    console.log(`[ai ${tag}] JSON.parse 成功`, parsed);
    return parsed;
  } catch (e) {
    console.warn(`[ai ${tag}] 直接 JSON.parse 失败，尝试在文本中找 {...}：`, e);
  }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) {
    console.error(`[ai ${tag}] 文本中找不到 {} 包裹的 JSON`);
    throw new Error('LLM 返回不含 JSON');
  }
  console.log(`[ai ${tag}] 提取 {...} 片段：\n`, m[0]);
  try {
    const parsed = JSON.parse(m[0]);
    console.log(`[ai ${tag}] 片段 JSON.parse 成功`, parsed);
    return parsed;
  } catch (e) {
    console.error(`[ai ${tag}] 片段也无法 parse：`, e);
    throw e;
  }
}

const INTENT_SYSTEM = `你是 Outio 出行推荐助手的意图解析模块。用户会用自然语言描述想去哪里玩，你需要将其转化为数据库查询条件。

核心原则：
- 宽松匹配：宁可多返回候选，不要过度限制。用户说"有山有水"不代表必须同时有山和水
- categories 尽量给 3-5 个相关分类，不要只给1个
- keywords 最多给2个核心关键词，不要把用户每个字都变成关键词
- childFriendly/outdoor/season 只在用户明确提到时才设为 true/false，否则设为 null
- maxResults 默认 30(给精排留够候选)
- city 默认"北京市"

可选的 categories 值：${ALLOWED_CATEGORIES.join('、')}

示例：
用户："带孩子去有山有水的地方"
输出：{"categories":["景区","公园","水上活动","露营地","度假村"],"city":"北京市","keywords":["山","水"],"childFriendly":true,"outdoor":null,"season":null,"maxResults":30}

用户："室内儿童乐园"
输出：{"categories":["游乐场","亲子活动","休闲娱乐","亲子服务"],"city":"北京市","keywords":["儿童乐园","室内"],"childFriendly":true,"outdoor":false,"season":null,"maxResults":30}

用户："免费的公园，适合推婴儿车"
输出：{"categories":["公园","景区"],"city":"北京市","keywords":[],"childFriendly":true,"outdoor":true,"season":null,"maxResults":30}

只返回 JSON，不要其他文字。`;

export async function parseIntent(
  query: string,
  userProfile: UserProfile,
): Promise<ParsedIntent> {
  const userPrompt = `用户画像：\n${profileBrief(userProfile)}\n\n用户查询："${query}"\n\n输出 JSON。`;
  console.log('[ai parseIntent] 开始，原始查询:', query);
  let raw: string;
  try {
    raw = await callDeepSeek('parseIntent', INTENT_SYSTEM, userPrompt, {
      temperature: 0.3,
      jsonMode: true,
    });
  } catch (e) {
    console.error('[ai parseIntent] callDeepSeek 失败:', e);
    throw new AiError(
      e instanceof Error ? e.message : String(e),
      'parse',
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson('parseIntent', raw) as Record<string, unknown>;
  } catch (e) {
    console.error('[ai parseIntent] extractJson 失败:', e, '原始 content:', raw);
    throw new AiError(
      `意图 JSON 解析失败：${e instanceof Error ? e.message : String(e)}`,
      'parse',
    );
  }

  // 过滤 categories 防止模型返回不存在的类目
  const cats = Array.isArray(parsed.categories) ? parsed.categories : [];
  const validCats = cats
    .filter((c): c is string => typeof c === 'string')
    .filter((c) => (ALLOWED_CATEGORIES as readonly string[]).includes(c));

  // 容错：模型可能返回 "北京" 而 DB 是 "北京市"
  const rawCity = typeof parsed.city === 'string' && parsed.city ? parsed.city : '北京市';
  const city = /[市州县区]$/.test(rawCity) ? rawCity : `${rawCity}市`;

  return {
    categories: validCats,
    city,
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((k): k is string => typeof k === 'string')
      : [],
    childFriendly:
      typeof parsed.childFriendly === 'boolean' ? parsed.childFriendly : undefined,
    outdoor: typeof parsed.outdoor === 'boolean' ? parsed.outdoor : undefined,
    season:
      typeof parsed.season === 'string' && parsed.season ? parsed.season : undefined,
    maxResults:
      typeof parsed.maxResults === 'number' && parsed.maxResults > 0
        ? Math.min(parsed.maxResults, 30)
        : 30,
  };
}

const RANK_SYSTEM = `你是 Outio 出行推荐助手。根据用户需求和家庭画像，从候选目的地中精选最合适的，并为每个写一段有吸引力的推荐理由。

用户画像：
- 家住北京顺义区后沙峪
- 一家三口：爸爸、妈妈，和一个 18 个月大的孩子叫旺仔
- 纯电车型（充电桩是加分项，不是硬性要求）
- 偏好户外活动

推荐理由写作要求：
- 25-60字，要有具体信息和场景感，不要泛泛而谈
- 突出这个地方的独特卖点，不要每个都说"适合带孩子"
- 可以提到具体的玩法、特色景观、最佳时间等
- 如果知道这个地方的特点（比如有湖、有花、有动物），要具体说出来
- 只在确实相关时提婴儿车 / 旺仔，不要每条都提
- 语气轻松自然，像朋友推荐，不像导游念稿

好的推荐理由示例：
- "春天樱花大道绝美，小路平坦可以推车，湖边还能喂鸭子，旺仔肯定喜欢。"
- "藏在胡同里的小型自然博物馆，恐龙化石和蝴蝶标本，小朋友看得走不动路。"
- "京郊最容易到达的溪谷，水浅可以踩水，山不高但树荫多，夏天凉快。"

差的推荐理由（避免）：
- "适合亲子游玩，环境不错。"（太泛）
- "推着婴儿车带旺仔散步很方便。"（模板化）

从候选中选出最适合的 5-10 个，按推荐度排序。输出 JSON 对象，包含 rankings 数组：
{"rankings":[{"id":"目的地UUID","reason":"推荐理由"}]}
只返回 JSON，不要其他文字。`;

interface RankCandidate {
  id: string;
  name: string;
  city: string;
  district?: string | null;
  main_category: string;
  sub_category?: string | null;
  tags?: string[] | null;
  description?: string | null;
  child_friendly?: boolean | null;
  indoor_outdoor?: string | null;
  has_ev_charging?: boolean | null;
  rating?: number | null;
}

// 给 LLM 看的候选简化版（剔掉前端视图字段、长字段截断）
function toCandidate(d: Destination): RankCandidate {
  return {
    id: d.id,
    name: d.name,
    city: d.city,
    district: d.district,
    main_category: d.main_category,
    sub_category: d.sub_category,
    tags: d.tags,
    description: d.description ? d.description.slice(0, 200) : null,
    child_friendly: d.child_friendly,
    indoor_outdoor: d.indoor_outdoor,
    has_ev_charging: d.has_ev_charging,
    rating: d.rating,
  };
}

export async function rankAndExplain(
  destinations: Destination[],
  query: string,
  userProfile: UserProfile,
): Promise<AiRanking[]> {
  if (destinations.length === 0) return [];

  const candidates = destinations.map(toCandidate);
  const userPrompt = [
    `用户画像：\n${profileBrief(userProfile)}`,
    `用户查询："${query}"`,
    `候选目的地（${candidates.length} 条）：\n${JSON.stringify(candidates, null, 0)}`,
    '输出 JSON。',
  ].join('\n\n');

  console.log('[ai rankAndExplain] 开始，候选数:', candidates.length);
  let raw: string;
  try {
    raw = await callDeepSeek('rankAndExplain', RANK_SYSTEM, userPrompt, {
      temperature: 0.5,
      jsonMode: true,
    });
  } catch (e) {
    console.error('[ai rankAndExplain] callDeepSeek 失败:', e);
    throw new AiError(
      e instanceof Error ? e.message : String(e),
      'rank',
    );
  }

  let parsedAny: unknown;
  try {
    parsedAny = extractJson('rankAndExplain', raw);
  } catch (e) {
    console.error('[ai rankAndExplain] extractJson 失败:', e, '原始 content:', raw);
    throw new AiError(
      `精排 JSON 解析失败：${e instanceof Error ? e.message : String(e)}`,
      'rank',
    );
  }

  // 兼容两种格式：顶层数组 / 对象里的 rankings 字段
  const rankings: unknown[] = Array.isArray(parsedAny)
    ? parsedAny
    : Array.isArray((parsedAny as { rankings?: unknown }).rankings)
      ? ((parsedAny as { rankings: unknown[] }).rankings)
      : [];
  console.log('[ai rankAndExplain] 解析后 rankings 数:', rankings.length);
  const validIds = new Set(destinations.map((d) => d.id));
  return rankings
    .filter(
      (r): r is { id: string; reason: string } =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as { id?: unknown }).id === 'string' &&
        typeof (r as { reason?: unknown }).reason === 'string',
    )
    .filter((r) => validIds.has(r.id));
}
