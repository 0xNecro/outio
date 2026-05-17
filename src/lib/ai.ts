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
  // 地理距离相关：用于走 PostGIS search_nearby RPC
  nearLat?: number;     // 中心点纬度，未提到具体地点时用家坐标
  nearLng?: number;     // 中心点经度
  nearName?: string;    // 中心点名称（如"后沙峪"）；纯调试用
  maxDistanceKm?: number; // 最大半径（公里）。"附近"≈10、"不想开太远"≈30、"1h 车程"≈60
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
    console.warn(`[ai ${tag}] 直接 JSON.parse 失败，尝试在文本中找 JSON 片段：`, e);
  }
  // 兜底：优先找数组 [...]，再找对象 {...}（rankAndExplain 期望数组）
  const arrM = cleaned.match(/\[[\s\S]*\]/);
  const objM = cleaned.match(/\{[\s\S]*\}/);
  const candidate = arrM?.[0] ?? objM?.[0];
  if (!candidate) {
    console.error(`[ai ${tag}] 文本中找不到 [] 或 {} 包裹的 JSON`);
    throw new Error('LLM 返回不含 JSON');
  }
  console.log(`[ai ${tag}] 提取片段：\n`, candidate);
  try {
    const parsed = JSON.parse(candidate);
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

地理距离字段（重要）：
- nearLat / nearLng：搜索中心点经纬度（WGS84）。
  * 用户提到具体地点（"后沙峪附近"/"望京周边"/"奥森旁边"）→ 解析出该地点的近似坐标
  * 没提地点 → 用家坐标 lat=40.086, lng=116.537（后沙峪）
  * 北京常见地点参考坐标：
    - 后沙峪/天竺：40.086, 116.537
    - 望京：40.000, 116.470
    - 国贸/CBD：39.910, 116.460
    - 三里屯：39.937, 116.456
    - 海淀中关村：39.984, 116.316
    - 西二旗：40.054, 116.300
    - 奥森公园：40.012, 116.398
    - 颐和园：39.999, 116.275
    - 香山：39.997, 116.190
    - 怀柔城区：40.316, 116.642
    - 密云水库：40.485, 116.872
    - 雁栖湖：40.422, 116.677
    - 古北水镇：40.660, 117.220
    - 通州城区：39.910, 116.660
    - 大兴黄村：39.728, 116.341
    - 房山良乡：39.736, 116.137
- maxDistanceKm：用户对距离的容忍度（公里）
  * "附近"/"周边"/"旁边" → 10
  * "不远"/"不想开太远" → 30
  * "1 小时车程"/"郊区也行" → 60
  * 没提及 → 60
- 如果用户问的是"哪里"这种无地点限定的泛问，保持 nearLat/Lng = 家坐标、maxDistanceKm = 60

示例：
用户："带孩子去有山有水的地方"
输出：{"categories":["景区","公园","水上活动","露营地","度假村"],"city":"北京市","keywords":["山","水"],"childFriendly":true,"outdoor":null,"season":null,"maxResults":30,"nearLat":40.086,"nearLng":116.537,"nearName":"后沙峪(家)","maxDistanceKm":60}

用户："后沙峪附近带旺仔玩的地方"
输出：{"categories":["公园","游乐场","景区","采摘园","亲子活动"],"city":"北京市","keywords":[],"childFriendly":true,"outdoor":null,"season":null,"maxResults":30,"nearLat":40.086,"nearLng":116.537,"nearName":"后沙峪","maxDistanceKm":10}

用户："望京周边的室内儿童乐园"
输出：{"categories":["游乐场","亲子活动","休闲娱乐","亲子服务"],"city":"北京市","keywords":["儿童乐园"],"childFriendly":true,"outdoor":false,"season":null,"maxResults":30,"nearLat":40.000,"nearLng":116.470,"nearName":"望京","maxDistanceKm":10}

用户："1 小时车程内的采摘园"
输出：{"categories":["采摘园","景区"],"city":"北京市","keywords":[],"childFriendly":null,"outdoor":true,"season":null,"maxResults":30,"nearLat":40.086,"nearLng":116.537,"nearName":"后沙峪(家)","maxDistanceKm":60}

注意：用户的需求通常是模糊的，要往宽了理解。"带孩子去玩"应该包含公园、游乐场、博物馆、采摘园、景区等多个分类。不要把分类限制得太窄。

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

  // 地理字段。模型给的坐标如果不在合理范围内（中国大陆 lat 18-54, lng 73-135）就当无效，回退家坐标
  const rawLat = typeof parsed.nearLat === 'number' ? parsed.nearLat : NaN;
  const rawLng = typeof parsed.nearLng === 'number' ? parsed.nearLng : NaN;
  const latOk = rawLat >= 18 && rawLat <= 54;
  const lngOk = rawLng >= 73 && rawLng <= 135;
  const nearLat = latOk ? rawLat : 40.086;
  const nearLng = lngOk ? rawLng : 116.537;
  const nearName =
    typeof parsed.nearName === 'string' && parsed.nearName ? parsed.nearName : undefined;

  const rawKm = typeof parsed.maxDistanceKm === 'number' ? parsed.maxDistanceKm : NaN;
  // 限定 [1, 200] 公里，防止模型瞎给
  const maxDistanceKm = Number.isFinite(rawKm) && rawKm > 0
    ? Math.min(Math.max(rawKm, 1), 200)
    : 60;

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
    nearLat,
    nearLng,
    nearName,
    maxDistanceKm,
  };
}

const RANK_SYSTEM = `你是一个住在北京、经常带娃出门的朋友。你去过很多地方，踩过很多坑，也发现过很多宝藏。现在朋友问你推荐，你会像发小红书一样真诚分享。

用户画像：
- 家住北京顺义区后沙峪
- 一家三口（爸爸妈妈+18个月的旺仔）
- 纯电车（充电桩是加分不是必须）
- 偏好户外

写推荐理由时：
- 像朋友聊天一样说话，不要用"适合""推荐""值得"这种官方词
- 说具体的体验和细节，比如"门口那条小路特别适合让娃自己走""湖边有一片草地可以铺垫子野餐"
- 可以提醒实用信息，比如"周末人巨多建议工作日去""停车场在北门比较近""带上小推车比推车方便"
- 如果知道这个地方有什么特别的（花、动物、水、沙子），一定要说
- 根据旺仔的年龄（18个月，刚会走路，喜欢水和动物和沙子）来说为什么适合
- 考虑从后沙峪出发的实际情况（京承高速方向更近、去城里堵车等）
- 语气自然随意，可以用"超赞""踩雷""亲测"这种口语
- 30-80字，不要太短也不要太长

好的例子：
- "离后沙峪超近，走京承20分钟就到。有一片浅水区旺仔可以踩水，岸边沙地也能玩半天。周末去的话车位紧张，建议9点前到。"
- "虽然叫博物馆但其实特别适合小娃，一楼有个沙池和滑梯区，旺仔这个月龄正好。二楼的恐龙骨架他肯定会盯着看。亲测能玩两小时。"
- "就是个社区小公园但胜在人少安静，有个小湖可以看鸭子，草地很平可以让旺仔撒欢跑。缺点是没啥吃的，自己带点零食。"

不好的例子（避免）：
- "环境优美，适合亲子出游，是周末休闲的好去处。"（太官方）
- "该公园设施完善，有儿童游乐区，适合家庭出行。"（像百度百科）
- "推着婴儿车很方便，适合带小朋友游玩。"（没有任何具体信息）

从候选中选最适合的5-10个，按推荐度排序。返回JSON数组：
[{"id":"目的地UUID","reason":"推荐理由"}]
只返回JSON。`;

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
  distance_km?: number | null;
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
    distance_km:
      typeof d.distance_meters === 'number'
        ? Math.round((d.distance_meters / 1000) * 10) / 10
        : null,
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
    // jsonMode 强制顶层 object，会和 prompt 要求的数组返回冲突，故关闭
    // markdown 围栏/解释文字由 extractJson 兜底
    raw = await callDeepSeek('rankAndExplain', RANK_SYSTEM, userPrompt, {
      temperature: 0.7,
      jsonMode: false,
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
