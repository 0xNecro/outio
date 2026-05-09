# Outio — 架构设计文档

> 高信息密度、客观中立、带个性化智能推荐的出行目的地工具

## 1. 产品定义

### 核心场景
周末或假期前，用户打开 Outio，用自然语言描述需求（"这周想带孩子去有山有水的地方，最好车程1小时内"），系统结合用户偏好、家庭画像、季节天气等上下文，从结构化数据库中筛选并推荐目的地，以卡片形式呈现。

### 差异化
- **客观中立**：基于 POI 数据和结构化标签推荐，不依赖 UGC 软广
- **个性化记忆**：记住家庭成员、偏好、去过的地方、孩子年龄等
- **智能上下文**：季节、天气、健康状态自动纳入推荐逻辑
- **信息密度高**：一张卡片展示做决策需要的全部信息

### 用户画像
一二线城市、有娃家庭、注重信息质量、不喜欢广告和主观滤镜。初期以亲子为主，架构支持全人群扩展。

---

## 2. 技术架构

```
┌─────────────────────────────────────────────┐
│              前端 (Vercel)                     │
│         React + Vite + TypeScript             │
│         TailwindCSS + 移动端优先               │
│                                               │
│  ┌───────────┐  ┌──────────────────────────┐  │
│  │ 筛选面板   │  │  AI 对话推荐界面          │  │
│  │ 分类/城市  │  │  自然语言输入             │  │
│  │ 距离/标签  │  │  → Supabase Edge Func    │  │
│  └─────┬─────┘  └────────┬─────────────────┘  │
│        │                  │                    │
│        ▼                  ▼                    │
│  ┌──────────────────────────────────────────┐ │
│  │         结果展示：卡片列表 + 地图          │ │
│  └──────────────────────────────────────────┘ │
└───────────────┬─────────────────┬─────────────┘
                │                 │
                ▼                 ▼
┌───────────────────┐  ┌─────────────────────────┐
│  Supabase          │  │  Supabase Edge Function  │
│  PostgreSQL+PostGIS│  │  (AI 推荐层)             │
│                    │  │                          │
│  destinations 表   │  │  接收自然语言 →           │
│  user_profiles 表  │  │  构建 SQL 查询 →          │
│  visit_history 表  │  │  调用 Claude API →        │
│  user_prefs 表     │  │  返回推荐结果+理由         │
└───────────────────┘  └─────────────────────────┘
```

### 技术选型理由

| 组件 | 选择 | 理由 |
|------|------|------|
| 前端框架 | React + Vite + TS | 和 WangzaiOS 一致，复用经验 |
| 样式 | TailwindCSS | 移动端响应式，开发效率高 |
| 数据库 | Supabase (PostgreSQL + PostGIS) | 免费额度够，地理查询原生支持，和 WangzaiOS 同平台 |
| AI 层 | Supabase Edge Function + Claude API | AI 调用放服务端，保护 API key，控制成本 |
| 部署 | Vercel | 和现有项目一致 |
| 地图 | 高德地图 JS API（国内）| 数据源本身来自高德，坐标一致 |

### 不选什么
- **不用 Next.js**：这是一个单页工具，不需要 SSR/SSG，Vite 更轻
- **不用独立后端**：Supabase Edge Function 覆盖 AI 推荐需求，不需要单独的 Node 服务
- **不用 MongoDB**：地理查询 PostGIS 远强于 MongoDB 的 geospatial

---

## 3. 数据模型

### 3.1 destinations（目的地主表）

```sql
CREATE TABLE destinations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     TEXT,              -- 原始数据源 ID（高德 uid 等）
  name          TEXT NOT NULL,
  country       TEXT DEFAULT '中国',
  province      TEXT,
  city          TEXT NOT NULL,
  district      TEXT,
  address       TEXT,
  location      GEOGRAPHY(POINT, 4326),  -- WGS84 坐标，PostGIS
  
  -- 分类
  main_category TEXT NOT NULL,     -- 景区/公园/博物馆/游乐场...
  sub_category  TEXT,              -- 高德 type2
  detail_type   TEXT,              -- 高德 type3
  tags          TEXT[],            -- 自由标签：["有山","有水","免费","5A"]
  
  -- 属性
  suitable_for    TEXT[],          -- ["亲子","老人","情侣","朋友","独行","团建"]
  child_friendly  BOOLEAN,
  min_age         INT,             -- 建议最小年龄
  max_age         INT,             -- 建议最大年龄（如儿童乐园上限）
  best_season     TEXT[],          -- ["春","夏","秋","冬"]
  indoor_outdoor  TEXT,            -- indoor/outdoor/both
  
  -- 信息
  description     TEXT,
  tips            TEXT,
  ticket_price    NUMERIC,         -- 成人票价，0=免费
  rating          NUMERIC(2,1),    -- 0-5 评分
  
  -- 设施
  has_parking     BOOLEAN,
  has_ev_charging BOOLEAN,
  stroller_ok     BOOLEAN,
  wheelchair_ok   BOOLEAN,
  
  -- 联系
  phone           TEXT,
  website         TEXT,
  
  -- 元数据
  data_source     TEXT,            -- gaode_poi / codex / user / manual
  confidence      TEXT,            -- high/medium/low
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 地理空间索引（核心性能）
CREATE INDEX idx_destinations_location ON destinations USING GIST (location);

-- 常用筛选索引
CREATE INDEX idx_destinations_city ON destinations (city);
CREATE INDEX idx_destinations_category ON destinations (main_category);
CREATE INDEX idx_destinations_city_category ON destinations (city, main_category);

-- 全文搜索
CREATE INDEX idx_destinations_name_fts ON destinations 
  USING GIN (to_tsvector('simple', name));
```

### 3.2 user_profiles（用户画像）

```sql
CREATE TABLE user_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id),
  
  -- 家庭信息
  family_members  JSONB,
  -- 示例: [
  --   {"name": "旺仔", "role": "child", "birth_date": "2024-11-28"},
  --   {"name": "爸爸", "role": "parent"},
  --   {"name": "奶奶", "role": "grandparent", "mobility": "limited"}
  -- ]
  
  -- 常驻地（用于计算距离）
  home_location   GEOGRAPHY(POINT, 4326),
  home_city       TEXT,
  
  -- 偏好
  preferences     JSONB,
  -- 示例: {
  --   "max_drive_minutes": 90,
  --   "prefers_outdoor": true,
  --   "avoids": ["人多的室内"],
  --   "car_type": "electric",  -- 影响充电桩需求
  --   "budget_sensitivity": "medium"
  -- }
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 visit_history（去过的地方）

```sql
CREATE TABLE visit_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id),
  destination_id  UUID REFERENCES destinations(id),
  visited_at      DATE,
  rating          INT CHECK (rating BETWEEN 1 AND 5),  -- 用户自己的评分
  notes           TEXT,                                  -- 备注
  would_revisit   BOOLEAN,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.4 数据扩展策略

```
覆盖密度分三级：

L1 - 高密度（常驻地）
  北京+京津冀：22万条，精确到采摘园/露营地
  数据源：高德 POI 全量 + Codex enrichment
  
L2 - 中密度（全国热门城市）
  20-30 个城市：每城市 3000-5000 条核心目的地
  数据源：高德 POI 旅游分类 + AI 补充标签
  优先城市：上海/广州/深圳/成都/杭州/南京/西安/
           重庆/武汉/长沙/青岛/大连/厦门/三亚/
           昆明/桂林/苏州/无锡

L3 - 低密度（其他地区 + 国外）
  只收录知名目的地（5A景区/国家公园/世界遗产/迪士尼级别）
  数据源：AI 知识 + 用户实时查询时动态搜索补充
  国外暂不预导入数据，靠 AI 实时推荐
```

---

## 4. AI 推荐层设计

### 4.1 工作流

```
用户输入: "这周想带旺仔去有山有水的地方，车程1小时内"
                          │
                          ▼
              Supabase Edge Function
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
         读取用户     解析意图      获取上下文
         画像+偏好   (Claude API)   (季节/天气)
              │           │           │
              └───────────┼───────────┘
                          ▼
                  构建 SQL 查询
                  (PostGIS 距离筛选
                   + 标签匹配
                   + 排除去过的)
                          │
                          ▼
                  数据库返回候选集
                  (20-50 条)
                          │
                          ▼
              Claude API 精排 + 生成推荐理由
              (输入：候选集 + 用户画像 + 上下文)
                          │
                          ▼
              返回 Top 5-10 推荐
              (含个性化推荐理由)
```

### 4.2 Claude API 调用策略

```
两次调用，控制成本：

第一次调用（轻量，解析意图）：
  模型：Claude Haiku（成本最低）
  输入：用户原始文本 + 用户画像摘要
  输出：结构化筛选条件 JSON
  {
    "categories": ["景区"],
    "landscape": ["山", "水"],
    "max_distance_km": 60,
    "exclude": ["indoor"],
    "age_appropriate": 1.5,
    "season": "当前季节"
  }

第二次调用（中等，精排推荐）：
  模型：Claude Sonnet
  输入：候选目的地列表(10-20条) + 用户画像 + 原始需求
  输出：排序后的推荐 + 每个的推荐理由
```

### 4.3 成本控制

- 意图解析用 Haiku（~$0.001/次）
- 精排用 Sonnet（~$0.01/次）
- 每次推荐总成本 < $0.02
- 个人使用每月 < $5
- 100 活跃用户每月 < $50
- 缓存热门查询结果，相同条件复用

---

## 5. 前端设计方向

### 移动端优先、卡片式、极简

```
┌──────────────────────────┐
│  Outio                   │
│                          │
│  ┌──────────────────────┐│
│  │ 🔍 想去哪儿？         ││  ← 自然语言输入框
│  │    带孩子周末去有山... ││
│  └──────────────────────┘│
│                          │
│  快捷标签：               │
│  [亲子] [周末] [免费]     │
│  [有山有水] [1h车程内]    │
│                          │
│  ─────────────────────── │
│                          │
│  为你推荐 5 个目的地       │
│                          │
│  ┌──────────────────────┐│
│  │ 📍 百望山森林公园      ││
│  │ 海淀区 · 车程35分钟    ││
│  │ ⭐ 4.2 · 免费 · 户外   ││
│  │ 适合：亲子 老人 独行    ││
│  │                      ││
│  │ "城区最近的登山选择，   ││
│  │  适合旺仔年龄，步道     ││
│  │  平缓有树荫"           ││
│  │                      ││
│  │ [导航] [详情] [标记去过]││
│  └──────────────────────┘│
│                          │
│  ┌──────────────────────┐│
│  │ 📍 妙峰山             ││
│  │ 门头沟 · 车程55分钟    ││
│  │ ...                   ││
│  └──────────────────────┘│
│                          │
└──────────────────────────┘
```

### 设计原则
- **无广告、无推广**：干净的信息呈现
- **一屏一决策**：不要让用户在推荐结果里再做大量筛选
- **推荐理由 > 目的地名**：告诉用户"为什么推荐这个给你"
- **去过标记**：避免重复推荐，积累数据

---

## 6. 与 WangzaiOS 的关系

```
WangzaiOS (未来整合平台)
├── 成长记录模块
├── 健康追踪模块
├── Outio 出行模块  ← 独立可用，数据可互通
│   ├── 独立入口：outio.0xnecro.com 或 outio.vercel.app
│   ├── 独立 repo：outio
│   └── 共享 Supabase 项目（同库不同表，或同项目不同 schema）
└── 其他未来模块
```

### 数据互通点
- WangzaiOS 的旺仔出生日期 → Outio 自动计算年龄用于适龄推荐
- WangzaiOS 的健康事件（如"感冒住院"）→ Outio 推荐时排除不适合的
- Outio 的出行记录 → WangzaiOS 的成长时间线

### 实现方式
- 同一个 Supabase 项目，不同表，通过 user_id 关联
- 前端独立部署，通过 Supabase client 共享认证和数据

---

## 7. 开发计划

### Phase 1 — MVP（2-3周）
交付：可用的移动端 Web App，包含 AI 推荐

- [ ] Supabase 建表 + 导入高德清洗数据
- [ ] Edge Function：意图解析 + SQL 查询 + AI 精排
- [ ] 前端：输入框 + 快捷标签 + 卡片结果展示
- [ ] 基础用户画像（硬编码你的家庭信息）
- [ ] 部署 Vercel

### Phase 2 — 个性化（2周）
- [ ] 用户注册/登录（Supabase Auth）
- [ ] 用户画像编辑（家庭成员、偏好）
- [ ] 去过标记 + 不再推荐
- [ ] 推荐理由基于用户画像个性化

### Phase 3 — 数据扩展（持续）
- [ ] 全国 L2 城市数据导入
- [ ] Codex 持续补充标签
- [ ] 用户反馈 loop（评分、纠错）

### Phase 4 — WangzaiOS 整合
- [ ] 共享认证
- [ ] 数据互通
- [ ] 统一入口

---

## 8. 文件结构（预期）

```
outio/
├── public/
├── src/
│   ├── components/
│   │   ├── SearchInput.tsx       # 自然语言输入
│   │   ├── QuickTags.tsx         # 快捷标签
│   │   ├── DestinationCard.tsx   # 目的地卡片
│   │   ├── ResultList.tsx        # 结果列表
│   │   └── MapView.tsx           # 地图视图（Phase 2）
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client
│   │   └── types.ts              # TypeScript 类型定义
│   ├── hooks/
│   │   ├── useRecommend.ts       # AI 推荐 hook
│   │   └── useProfile.ts         # 用户画像 hook
│   ├── pages/
│   │   ├── Home.tsx              # 主页（搜索+推荐）
│   │   ├── Detail.tsx            # 目的地详情
│   │   └── Profile.tsx           # 个人设置（Phase 2）
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   ├── migrations/
│   │   └── 001_init.sql          # 建表 SQL
│   └── functions/
│       └── recommend/
│           └── index.ts          # AI 推荐 Edge Function
├── scripts/
│   └── import_gaode.py           # 数据导入脚本
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```
