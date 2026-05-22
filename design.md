# Outio 设计系统

> Outio 是移动端目的地推荐 App，属于"工具/应用类"。遵循审美总纲，保留必要的交互色彩。
> 上游参考：`~/ai-workspace/DESIGN-PREFERENCES.md` + `~/workspace/aesthetic-profile.md`
> 2026-05-21 首版 → 2026-05-22 v2，对齐审美画像更新。

---

## 1. 设计哲学

- **发现感**：帮用户找到想去的地方，界面安静但内容有温度
- **移动优先**：448px 容器居中，所有交互为触摸设计
- **克制配色**：陶土/琥珀品牌色只用于关键触点，大面积用暖白
- **文字即内容**：目的地信息靠排版层级传达，不依赖密集图标

---

## 2. 色彩系统

### 2.1 基础色

| Token | 值 | 用途 |
|-------|-----|------|
| `page-bg` | `#F5F5F3` | 页面背景（暖灰白） |
| `card-bg` | `#FFFFFF` | 卡片背景 |
| `card-border` | `#DDDBD6` | 卡片边框 |
| `on-surface` | `#1C1B22` | 主文字 |
| `on-surface-variant` | `#474553` | 次要标题 |
| `secondary` | `#5D5D6B` | 弱化文字、图标 |
| `outline` | `#787584` | 占位符、区块标签 |
| `outline-variant` | `#C8C4D5` | 边框 |

### 2.2 品牌色

| Token | 值 | 用途 |
|-------|-----|------|
| `primary` | `#9C6644` | 陶土棕（按钮、选中态） |
| `primary-container` | `#B87333` | 铜色/琥珀强调 |
| `on-primary` | `#FFFFFF` | 主色上的文字 |
| `on-primary-container` | `#FFE0C4` | 琥珀容器上的暖杏文字 |
| `primary-fixed` | `#FFECD8` | 暖杏浅底 |
| `primary-fixed-dim` | `#E8B48A` | 暖杏深底 |
| `inverse-primary` | `#E8B48A` | 反色主色 |
| `on-primary-fixed` | `#3D1E00` | 固定主色上的深棕文字 |
| `on-primary-fixed-variant` | `#7A4B2A` | 固定主色上的中棕文字 |
| `tag-selected-bg` | `#FDF0E6` | 选中标签暖桃浅底 |
| `tag-selected-text` | `#9C6644` | 选中标签陶土棕文字 |
| `tag-neutral-bg` | `#E6E5E0` | 未选标签底色 |
| `tag-neutral-text` | `#555555` | 未选标签文字 |

### 2.3 语义色

| 用途 | 色值 |
|------|------|
| 错误 | `#BA1A1A` |
| 评分/星级 | `#683500`（暖棕，tertiary） |

### 2.4 用色规则

- 陶土/琥珀只出现在品牌触点：选中标签、主按钮、导航高亮
- 大面积始终是 `page-bg` + `card-bg`
- 不用品牌色做大色块背景
- 不用高饱和度渐变

---

## 3. 字体

```
主字体：Plus Jakarta Sans（Google Fonts，已配置）
回退：system-ui, -apple-system, BlinkMacSystemFont, sans-serif
```

| 层级 | Token | 大小 | 字重 | 行高 | 字距 |
|------|-------|------|------|------|------|
| 大标题 | `heading-lg` | 18px | 500 | 1.2 | -0.01em |
| 中标题 | `heading-md` | 16px | 500 | 1.2 | -0.01em |
| 正文 | `body-md` | 14px | 400 | 1.5 | 0 |
| 标签 | `label-md` | 12px | 500 | 1.4 | 0.02em |
| 注释 | `caption` | 12px | 400 | 1.4 | 0 |

---

## 4. 间距与布局

- **容器**：`max-w-[28rem]`（448px）居中，`min-h-dvh`
- **页面内边距**：16px (`container_margin`)
- **卡片间距**：12px (`gutter`)
- **间距单位**：4px 步进（xs=4, sm=8, md=16, lg=24, xl=32）

### 圆角

| 元素 | 圆角 | 说明 |
|------|------|------|
| 卡片 | 12px (`radius-lg`) | 大圆角，柔软边缘 |
| 标签/图标 | 8px (`radius-xl`) | 药丸标签 |
| 按钮/搜索框 | 12px (`radius-full`) | 圆润交互元素 |

---

## 5. 组件规范

### 5.1 目的地卡片（DestinationCard）
- 白底 + `card-border` 1px 边框
- 圆角 12px
- 内边距 16px
- 无阴影
- 点击 `active:scale-[0.98]`
- 内容：标题 + 标签行 + 评分

### 5.2 搜索栏（SearchInput）
- 圆角 12px
- 背景 `surface-container-low`
- 前置搜索图标（Material Symbols, wght 300）
- 占位符色 `outline`

### 5.3 筛选标签（FilterTags）
- 横向滚动，无滚动条
- 选中：`tag-selected-bg` + `tag-selected-text`
- 未选：`tag-neutral-bg` + `tag-neutral-text`
- 圆角 12px，内边距 `6px 14px`

### 5.4 底部导航（BottomNavBar）
- 固定底部 + safe-area
- Material Symbols 图标
- 选中态 `primary` 色
- 未选态 `secondary` 色

### 5.5 AI 摘要卡片（AISummaryCard）
- 与目的地卡片同样式
- 内容区域用 `body-md` 排版
- 不加特殊装饰（不用渐变、不用光效）

---

## 6. 图标

- **Material Symbols Outlined**，wght 300，opsz 24，size 20px
- filled 变体用 `font-variation-settings: "FILL" 1` 表示选中
- 不用额外图标库
- 图标始终配合文字，不单独承载语义

---

## 7. 动效

- 卡片点击：`active:scale-[0.98]`
- 页面切换：React Router 默认（无自定义过渡）
- 标签选中：即时切换，不加 transition
- 保持轻量，不做花哨动画

---

## 8. 与审美总纲对齐检查

| 总纲原则 | Outio 现状 | 状态 | 备注 |
|----------|-----------|------|------|
| 暖底色 | `#F5F5F3` ✓ | ✅ | |
| 克制用色 | 陶土/琥珀只在选中态出现 ✓ | ✅ | |
| 细线分隔 | 卡片 1px 边框 ✓ | ✅ | |
| 不用 Inter/Roboto | Plus Jakarta Sans ✓ | ✅ | |
| 低饱和度 | 陶土棕 #9C6644 饱和度适中 | ✅ | 与大地色暖白基调一致 |
| 无重阴影 | 无阴影 ✓ | ✅ | |
| 大圆角 | 卡片 12px ✓ | ✅ | 从 4px 升级到 12px 对齐审美画像 |

**结论：Outio 现有实现与总纲基本一致。品牌色已调整为陶土/琥珀体系，面积小、用途明确。**

---

## 9. 图标风格

- **Duotone 双色优先**（> 填充实心 > 线性描边），与审美画像一致
- 当前使用 Material Symbols Outlined，后续可逐步替换为 Duotone 图标
- 图标始终配合文字，不单独承载语义

## 10. 深色模式指引（暂未实施）

- **偏暖底**：深棕/暖炭灰，与 Outio 大地色暖白基调一致
- 参考 token 映射：
  - `page-bg` → `#1C1917`（暖深棕）
  - `card-bg` → `#292524`（暖炭灰）
  - `card-border` → `#404040`
  - `on-surface` → `#FAF9F7`（暖白）
  - `primary` → `#E8B48A`（暖杏深，保留陶土/琥珀品牌识别）
- 底色暖但光线清：文字用高对比暖白

## 11. 迁移说明

本文件替代原 `outio-design.md`。原文件中的 Material 3 完整 token 已迁移到 `src/index.css` 的 `@theme` 块中，本文件只记录设计决策和规范，不重复 CSS 变量定义。
