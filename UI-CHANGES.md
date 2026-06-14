# UI/UX Polish — Change Summary

Visual-only pass per UI plan. **No route, feature, or copy changes** (except empty-state structure).

## Deliverables

| File | Purpose |
|------|---------|
| `ui-audit.md` | Phase 0 inventory + chart audit |
| `app/design-tokens.css` | Spacing, type, color, elevation, motion, z-index |
| `UI-CHANGES.md` | This summary |

## Phase 1 — Design System

- Added **`app/design-tokens.css`** imported from `globals.css`
- Wired `--radius` and `--shadow` to token values
- **`--content-max: 1440px`** for page shells
- **`--touch-target: 44px`** for mobile HIG
- Geist fonts use **`display: "swap"`** in `app/layout.tsx`

## Phase 2 — Layout Shift

- Existing Suspense skeletons retained; shimmer uses token radius/timing
- Chart containers use **fixed heights** via CSS variables (`--ds-chart-height*`)
- Modal open uses fade + scale animation (no layout jump)

## Phase 3 — Alignment & Grid

- **Dashboard, Analytics, Audit logs, Reports** constrained to `--content-max` centered
- Audit form remains full-bleed (fixed score panel) — unchanged

## Phase 4 — Visual Polish

| Area | Change |
|------|--------|
| QMS tabs | Premium segmented pills (matches dashboard Period control) |
| QMS view toggle | Same segmented style + 44px touch targets |
| QMS empty states | Icon + message, dashed border, min-height |
| Modals | Fade/scale entrance, 44px close button, token z-index |
| Cards | Token padding, subtle shadow transition |
| Dropdown portal | z-index from `--ds-z-dropdown` |

## Phase 5 — Charts

| Fix | Files |
|-----|-------|
| `QmsChartFrame` wrapper | `components/analytics/qms-chart-frame.tsx` |
| `QMS_CHART_TOOLTIP` shared config | `qms-primitives.tsx` |
| Overflow visible on chart cards | `analytics.css` |
| Subtle chart entrance animation | `analytics.css` |
| Pie: empty via frame, minAngle, hide tiny labels | `compliance-tab.tsx` |
| Bar: horizontal grid only, animation off on update | all chart tabs |
| Tooltip z-index + no clip | all Recharts tabs |

## Deferred (future pass)

- Full hex → token migration in `analytics.css` status colors
- Unify dash-kpi / platform-kpi / qms-kpi into one CSS module
- Visual regression screenshots
- Chart-specific loading skeletons per tab (generic CardsPageSkeleton OK for now)

## Verify manually

1. **Analytics** — tab bar, charts, empty tabs, resize window
2. **Dashboard** — period control + KPI grid alignment
3. **Audit logs** — filter accordion + table scroll on 375px
4. **Reports** — toolbar + table
5. **Audit detail modal** — open animation, close button size on mobile
