# Outio Design Specification

> Generated from Google Stitch, refined for Claude Code implementation.

---

## 1. Design System

### 1.1 Color Tokens

Primary palette:
- primary: #3b309e (main brand purple)
- primary-container: #534ab7 (darker purple for emphasis)
- on-primary: #ffffff
- on-primary-container: #d1ccff
- primary-fixed: #e3dfff (light purple tint)

Surface palette:
- surface: #fcf8ff (app bar, nav bg)
- surface-container-lowest: #ffffff (card bg)
- surface-container-low: #f6f2fc (subtle fills)
- surface-container: #f0ecf6 (badge bg)
- surface-container-high: #ebe6f0
- surface-variant: #e5e1eb
- background: #F5F5F3 (page background warm gray)

Text palette:
- on-surface: #1c1b22 (primary text)
- on-surface-variant: #474553 (secondary headings)
- secondary: #5d5d6b (muted text, icons)
- outline: #787584 (placeholder, section labels)
- outline-variant: #c8c4d5 (borders)

Specific UI:
- card-border: #DDDBD6
- tag-selected-bg: #EEEDFE
- tag-selected-text: #534AB7
- tag-neutral-bg: #E6E5E0
- tag-neutral-text: #555555
- secondary-container: #e2e1f2
- error: #ba1a1a
- tertiary: #683500 (star rating color)

### 1.2 Typography

Font: Plus Jakarta Sans (Google Fonts)

- heading-lg: 18px, weight 500, line-height 1.2, letter-spacing -0.01em
- heading-md: 16px, weight 500, line-height 1.2, letter-spacing -0.01em
- body-md: 14px, weight 400, line-height 1.5
- label-md: 12px, weight 500, line-height 1.4, letter-spacing 0.02em
- caption: 12px, weight 400, line-height 1.4

Rules: sentence case everywhere, only weights 400/500, antialiased.

### 1.3 Spacing

- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- container_margin: 16px
- gutter: 12px

### 1.4 Border and Radius

- DEFAULT: 2px
- lg: 4px (cards)
- xl: 8px (logo, badges)
- full: 12px (pills, buttons, search input)
- Card border: 1px solid #DDDBD6

### 1.5 Icons

Google Material Symbols Outlined, loaded via CDN.
Default: FILL 0, wght 300, GRAD 0, opsz 24, size 20px.
Filled variants: FILL 1.
Inline with text: 14-16px.

Key icons: explore, search, location_on, star, auto_awesome, settings, arrow_back, bookmark, history, person, check_circle, near_me, local_parking, ev_station, stroller, call, schedule, confirmation_number, child_care, female, edit, info, logout, chevron_right, refresh, tune, smart_toy.

---

## 2. Components

### 2.1 Top App Bar

- Height: 56px, sticky top, z-50
- Background: surface, border-bottom outline-variant
- Max-width: md (448px), centered
- Left: 32x32 logo icon (bg dark, explore icon white) + "Outio" heading-lg bold primary
- Right: settings icon button 40x40

### 2.2 Search Input

- Height: 48px, white bg, border #DDDBD6, rounded-xl (12px)
- Left icon: search 20px, text-outline
- Placeholder: "想去哪儿？带孩子周末去..." text-outline-variant
- Focus: border-primary

### 2.3 Filter Tags

- Horizontal scroll, no scrollbar, full-bleed
- Pill: px-16px py-4px, rounded-full, label-md, whitespace-nowrap
- Selected: bg #EEEDFE, text #534AB7, border #534AB7/10
- Unselected: bg #E6E5E0, text #555, border transparent
- Gap: 8px

### 2.4 Destination Card (Home - text only)

- White bg, border #DDDBD6, rounded 4px, padding 16px
- Active: scale(0.98) 100ms
- Row 1: name (heading-md) + badge (label-md, bg surface-container or secondary-container)
- Row 2: location_on icon + district + drive time (caption, secondary)
- Row 3: star rating + season tag + outdoor tag (label-md pills)
- Row 4: border-top separator, AI icon circle + italic recommendation text (body-md, on-surface-variant)

### 2.5 Destination Card (Search Results - with image)

- White bg, border, rounded, overflow hidden
- Image: h-48, object-cover, with badge overlay
- Content: p-16, name (heading-lg bold) + location + AI reason with left border accent

### 2.6 Detail Page Layout

- Hero: 4-col grid (main image col-span-4 h-56, two thumbs col-span-2 h-24)
- Info card: rows with icon + label + value, separated by faint dividers
- Tags: horizontal scroll, primary tag purple bg, secondary tags gray
- AI card: primary-container bg (#534ab7), light text, decorative icon
- Facilities: 3-col grid, icon + label + status per cell
- Action bar: fixed bottom, two buttons (secondary + primary)

### 2.7 Profile Page

- Avatar: 96x96 circle, centered
- Cards: white bg, border, divide-y for rows
- Range slider: 4px track, 16px thumb primary color
- Toggle: 44x24, primary when on

### 2.8 Bottom Nav Bar

- Height: 64px, fixed bottom, z-50, surface bg, border-top
- 4 tabs: explore/bookmark/history/person
- Active: text-primary, icon filled
- Inactive: text-secondary
- Labels: Discover, Saved, History, Profile

---

## 3. Page Structures

### Home (发现)
Top App Bar > Search Input > Filter Tags > Section Label > Card List > Bottom Nav

### Detail (详情)
Top App Bar (back + name) > Hero Images > Info Card > Tags > AI Card > Facilities > Map > Action Bar

### Search Results (搜索结果)
Top App Bar (back) > User Query Bubble > AI Status > Response Header > Image Cards > Action Bar > Bottom Nav

### Profile (我的)
Top App Bar (back) > Avatar + Name > Family Card > Location Card > Preferences Card > About/Logout > Bottom Nav

---

## 4. Tailwind Config

The complete tailwind.config.js theme extension:

```javascript
{
  colors: {
    "surface-container-lowest": "#ffffff",
    "on-surface": "#1c1b22",
    "on-tertiary-container": "#ffc69a",
    "on-error-container": "#93000a",
    "surface": "#fcf8ff",
    "surface-container": "#f0ecf6",
    "surface-variant": "#e5e1eb",
    "surface-container-low": "#f6f2fc",
    "error": "#ba1a1a",
    "on-error": "#ffffff",
    "primary": "#3b309e",
    "tertiary": "#683500",
    "on-secondary-container": "#636371",
    "on-tertiary-fixed": "#2f1500",
    "inverse-on-surface": "#f3eff9",
    "secondary": "#5d5d6b",
    "primary-fixed": "#e3dfff",
    "inverse-primary": "#c5c0ff",
    "on-secondary": "#ffffff",
    "tertiary-fixed": "#ffdcc3",
    "outline": "#787584",
    "on-background": "#1c1b22",
    "secondary-container": "#e2e1f2",
    "outline-variant": "#c8c4d5",
    "tertiary-fixed-dim": "#ffb77d",
    "surface-dim": "#dcd8e2",
    "on-secondary-fixed-variant": "#454653",
    "primary-fixed-dim": "#c5c0ff",
    "surface-container-high": "#ebe6f0",
    "surface-tint": "#584fbc",
    "surface-bright": "#fcf8ff",
    "error-container": "#ffdad6",
    "background": "#fcf8ff",
    "primary-container": "#534ab7",
    "on-primary-container": "#d1ccff",
    "on-primary": "#ffffff",
    "on-surface-variant": "#474553",
    "inverse-surface": "#312f37",
    "on-secondary-fixed": "#191b26",
    "surface-container-highest": "#e5e1eb",
    "on-primary-fixed-variant": "#3f35a3",
    "secondary-fixed": "#e2e1f2",
    "on-primary-fixed": "#140067",
    "on-tertiary-fixed-variant": "#6e3900",
    "secondary-fixed-dim": "#c5c5d5",
    "tertiary-container": "#8a4900",
    "on-tertiary": "#ffffff"
  },
  borderRadius: {
    DEFAULT: "0.125rem",
    lg: "0.25rem",
    xl: "0.5rem",
    full: "0.75rem"
  },
  spacing: {
    container_margin: "16px",
    xl: "32px",
    xs: "4px",
    sm: "8px",
    unit: "4px",
    lg: "24px",
    gutter: "12px",
    md: "16px"
  },
  fontFamily: {
    "heading-md": ["Plus Jakarta Sans"],
    "heading-lg": ["Plus Jakarta Sans"],
    "caption": ["Plus Jakarta Sans"],
    "label-md": ["Plus Jakarta Sans"],
    "body-md": ["Plus Jakarta Sans"]
  },
  fontSize: {
    "heading-md": ["16px", {lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "500"}],
    "heading-lg": ["18px", {lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "500"}],
    "caption": ["12px", {lineHeight: "1.4", letterSpacing: "0", fontWeight: "400"}],
    "label-md": ["12px", {lineHeight: "1.4", letterSpacing: "0.02em", fontWeight: "500"}],
    "body-md": ["14px", {lineHeight: "1.5", letterSpacing: "0", fontWeight: "400"}]
  }
}
```

---

## 5. Implementation Notes

- Mobile-first: 375px viewport, all content max-w-md (448px) centered
- Use TailwindCSS with the custom theme config above
- Google Material Symbols via CDN (not Phosphor/Tabler as originally planned)
- Plus Jakarta Sans via Google Fonts CDN
- No images in home page cards (text + icons only)
- Scrollbar hiding: .no-scrollbar utility class
- Dark mode tokens defined but not prioritized for MVP
- Chinese UI text, English tab labels
- All animations subtle: scale and opacity transitions only
