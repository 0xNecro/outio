import type { Destination } from './types';

// 卡片 hero 占位色（首页文字卡 + 搜索结果卡通用）
const HERO_COLORS = [
  '#A7B58E', '#7F94B0', '#C8A878', '#8693B5', '#6FA6B5',
  '#B59FA7', '#94A9C8', '#D6BFA8', '#A8B7D6', '#7FBFB0',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// 给从 DB 拿到的 Destination 补上视图层字段（hero_color / badge）
// ai_reason 和 drive_minutes 暂留空，等接入 Edge Function / PostGIS 后填充
export function enrichForView(d: Destination): Destination {
  const hero_color = HERO_COLORS[hashString(d.id) % HERO_COLORS.length];

  let badge: string | undefined;
  if (d.ticket_price === 0) badge = '免费';
  else if (d.rating != null) badge = d.rating.toFixed(1) + '★';
  else if (d.sub_category) badge = d.sub_category;

  return { ...d, hero_color, badge };
}
