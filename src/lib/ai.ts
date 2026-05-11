// DeepSeek AI 调用：意图解析 + 候选精排（MVP 前端直调）
// 后续迁到服务端 Edge Function，避免 key 暴露
import type { Destination, UserProfile } from './types';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

// 与 destinations 表 main_category 取值对齐
const ALLOWED_CATEGORIES = [
  '景区', '公园', '博物馆', '游乐场', '寺庙宗教',
  '科技馆', '美术馆', '展览馆', '天文馆', '采摘园',
  '度假村', '露营地', '水上活动', '温泉洗浴', '垂钓园',
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

  const resp = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`DeepSeek ${resp.status}: ${text.slice(0, 200)}`);
  }
  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 返回空内容');
  return content;
}

// 模型偶尔会在 JSON 外裹 ```json ... ``` 或解释文字，做兜底
function extractJson(s: string): unknown {
  const trimmed = s.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('LLM 返回不含 JSON');
  return JSON.parse(m[0]);
}

const INTENT_SYSTEM = `你是 Outio 出行推荐助手的意图解析模块。
用户会用自然语言描述想去哪里玩，你需要把它转成结构化的筛选条件 JSON。

可用的 main_category 取值（只能从中选）：
${ALLOWED_CATEGORIES.join('、')}

输出 JSON schema（不要多余字段，不要解释）：
{
  "categories": string[],   // 从上面列表里选，可以多选；如果用户没明确就给最相关的 2-4 个
  "city": string,           // 必须是带"市"后缀的全名，如 "北京市"、"上海市"。默认 "北京市"
  "keywords": string[],     // 用户提到的具体名称/关键词，没有就空数组
  "childFriendly": boolean, // 用户提到带孩子/亲子/遛娃 → true
  "outdoor": boolean,       // 用户提到户外/室外/野外 → true；提到避雨/室内 → false
  "season": string,         // 春/夏/秋/冬，没提就 ""
  "maxResults": number      // 默认 20
}`;

export async function parseIntent(
  query: string,
  userProfile: UserProfile,
): Promise<ParsedIntent> {
  const userPrompt = `用户画像：\n${profileBrief(userProfile)}\n\n用户查询："${query}"\n\n输出 JSON。`;
  let raw: string;
  try {
    raw = await callDeepSeek(INTENT_SYSTEM, userPrompt, {
      temperature: 0.3,
      jsonMode: true,
    });
  } catch (e) {
    throw new AiError(
      e instanceof Error ? e.message : String(e),
      'parse',
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(raw) as Record<string, unknown>;
  } catch (e) {
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
        : 20,
  };
}

const RANK_SYSTEM = `你是 Outio 出行推荐助手的精排模块。
输入：用户的原始查询 + 家庭画像 + 候选目的地列表（包含 id/名称/类目/描述/标签等）。
任务：从候选中挑出最适合这个家庭的项目，按推荐度排序，并为每个写一条个性化推荐理由。

推荐理由要求：
- 简洁 1-2 句话（25-60 字）
- 具体说明为什么这个地方适合这个家庭，要引用画像里的具体信息（如孩子名字、年龄、老人、车型）
- 不要罗列景点本身的介绍，重点说"为什么是你"

输出 JSON schema（不要多余字段，不要解释）：
{
  "rankings": [
    { "id": "<候选 id>", "reason": "<推荐理由>" }
  ]
}
顺序即推荐排序；可以舍弃明显不合适的，但保留至少 5 条（如果有这么多候选）。`;

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

  let raw: string;
  try {
    raw = await callDeepSeek(RANK_SYSTEM, userPrompt, {
      temperature: 0.5,
      jsonMode: true,
    });
  } catch (e) {
    throw new AiError(
      e instanceof Error ? e.message : String(e),
      'rank',
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(raw) as Record<string, unknown>;
  } catch (e) {
    throw new AiError(
      `精排 JSON 解析失败：${e instanceof Error ? e.message : String(e)}`,
      'rank',
    );
  }

  const rankings = Array.isArray(parsed.rankings) ? parsed.rankings : [];
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
