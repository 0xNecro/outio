// destinations 表字段；保持与 Supabase schema 对齐
export type IndoorOutdoor = 'indoor' | 'outdoor' | 'both';

export interface Destination {
  // ==== DB 字段 ====
  id: string; // UUID
  source_id?: string | null;
  name: string;
  country?: string | null;
  province?: string | null;
  city: string;
  district?: string | null;
  address?: string | null;

  main_category: string;
  sub_category?: string | null;
  detail_type?: string | null;
  tags?: string[] | null;

  suitable_for?: string[] | null;
  child_friendly?: boolean | null;
  min_age?: number | null;
  max_age?: number | null;
  best_season?: string[] | null;
  indoor_outdoor?: IndoorOutdoor | null;

  description?: string | null;
  tips?: string | null;
  ticket_price?: number | null;
  rating?: number | null;

  has_parking?: boolean | null;
  has_ev_charging?: boolean | null;
  stroller_ok?: boolean | null;
  wheelchair_ok?: boolean | null;

  phone?: string | null;
  website?: string | null;

  data_source?: string | null;
  confidence?: string | null;

  // ==== 仅视图层字段，DB 没有，由 enrichForView() 在客户端填充 ====
  drive_minutes?: number;  // 后续接 PostGIS 距离计算
  ai_reason?: string;      // 后续接 AI Edge Function
  badge?: string;          // 派生：免费 / 评分 / 类目
  hero_color?: string;     // 派生：基于 id 的稳定哈希
}

// Profile 页临时数据（待用户认证 + user_profiles 表后切真实）
export interface FamilyMember {
  name: string;
  role: 'parent' | 'child' | 'grandparent' | 'partner';
  birth_date?: string;
  mobility?: 'normal' | 'limited';
}

export interface UserProfile {
  id: string;
  family_members: FamilyMember[];
  home_city: string;
  home_address: string;
  preferences: {
    max_drive_minutes: number;
    prefers_outdoor: boolean;
    avoids: string[];
    car_type: 'electric' | 'fuel' | 'hybrid';
    budget_sensitivity: 'low' | 'medium' | 'high';
  };
}
