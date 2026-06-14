# Phase 0 — UI/UX Audit

Read-only inventory before the Apple-level polish pass.

## Pages & States

| Route | Loading | Empty | Error | Notes |
|-------|---------|-------|-------|-------|
| `/login` | fallback | — | inline | OK |
| `/dashboard` | CardsPageSkeleton | KPI zeros | db alert | CSS bar trend (not Recharts) |
| `/audit-logs` | TablePageSkeleton | table empty row | filter empty | Accordion filters |
| `/analytics` | CardsPageSkeleton | QmsEmpty per tab | — | Recharts tabs |
| `/reports` | TablePageSkeleton | empty table | date validation | Client fetch |
| `/forms`, `/forms/audit` | skeletons | hub empty | toast | Fixed score panel |
| `/settings` | SettingsPageSkeleton | per tab | toast | Tabs |
| `/access-denied` | — | — | — | Static |

## Design System Gaps (pre-polish)

| Issue | Location | Severity |
|-------|----------|----------|
| Duplicate token definitions | `globals.css` `:root` vs scattered hex in `analytics.css` | Medium |
| QMS tab active = solid black pill | `analytics.css` `.qms-tabs__btn--active` | High — inconsistent with dashboard |
| Raw hex in analytics chips/badges | `analytics.css` `#16a34a`, `#fef2f2`, etc. | Medium |
| No `--content-max` on page bodies | dashboard vs full-bleed audit form | Low |
| Font loading | `next/font` Geist ✓; no explicit `display` | Low CLS risk |

## Layout Shift (CLS) Sources

| Source | Status |
|--------|--------|
| Fonts | Geist via `next/font` — low risk |
| Images | Minimal `<img>` usage; avatars are text initials |
| Data fetch | Suspense + page skeletons on all dashboard routes ✓ |
| Dynamic badges | Filter chips appear — reserved via accordion |
| Fixed header/sidebar | `--header-h: 64px` consistent ✓ |

## Component Variant Inconsistencies

| Element | Variants found |
|---------|----------------|
| Segmented controls | dash-periods (premium), qms-tabs (dark active), access-tabs, audit-segment |
| Cards | dash-kpi, qms-kpi, platform-kpi, ui-card — similar but separate CSS |
| Buttons | ui-btn, dash-refresh, qms-tabs__btn — unified via ui-btn where used |
| Empty states | ui-table__empty, qms-empty, dash-empty — mixed styling |

## Chart Audit (Analytics — Phase 5)

| Chart | Tab | Symptoms | Fix |
|-------|-----|----------|-----|
| Parameter bar chart | Parameters | X-axis label collision many params | Angled labels ✓; margin bottom 80 |
| Parameter radar | Parameters | Crowded labels many params | Truncation ✓ |
| Team bar chart | Teams | Overflow mobile | ResponsiveContainer ✓ |
| Agent bar chart | Agents | Y domain top view [88,100] breaks 1 agent | min height container |
| Auditor bar chart | Auditors | Label overlap | margin bottom |
| Severity pie | Compliance | Empty state inline `<p>` not QmsEmpty | Unify empty component |
| Feedback pie | Compliance | Single-slice label overlap | minAngle + hide small labels |
| Dashboard trend | Dashboard | CSS bars not Recharts | N/A — no breakage |

| Check | Result |
|-------|--------|
| Container overflow clips tooltips | `.qms-card` default overflow — **fix: chart cards overflow visible** |
| Zero data | Most tabs use QmsEmpty; pie uses plain text — **unify** |
| Resize | ResponsiveContainer on all Recharts ✓ |
| Default chart colors | CHART_COLORS constant — **wire to design tokens** |
| Loading skeleton | CardsPageSkeleton generic — acceptable |

## Hardcoded / Arbitrary Values

- Mostly rem-based in CSS files; few Tailwind arbitrary values in components
- Inline `style={{ width }}` on progress bars — intentional dynamic width
- Chart margins inline in TSX — acceptable per-chart tuning

## Z-Index

| Layer | Value |
|-------|-------|
| Sidebar mobile overlay | 30–40 |
| Custom select portal | 200 |
| Modal | ~60 in platform.css — **consolidate to token** |

## Responsive (375px) Risk Areas

- Audit logs table horizontal scroll ✓
- Analytics qms-tabs horizontal scroll ✓
- Dashboard KPI grid stacks ✓
- Touch targets on small icon buttons — **audit-logs action btns**

## Polish Priority

1. Design tokens file + import
2. QMS tabs / toggles → premium segmented style
3. Chart containers + tooltips + empty states
4. Modal motion + skeleton token alignment
5. Content max-width on analytics/dashboard/report shells
6. Mobile touch targets on primary controls
