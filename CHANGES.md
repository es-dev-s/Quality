# Production Hardening — Change Summary

Hardening pass per `plan (2).md`. **No intentional changes** to UI copy, routes, business rules, or scoring logic.

## Phase 0

| Deliverable | Description |
|-------------|-------------|
| `audit.md` | Read-only inventory of Server Actions, race hotspots, client fetch patterns |

## Phase 1 — Backend

| Change | Files | Why |
|--------|-------|-----|
| Idempotency key on audit create | `prisma/schema.prisma`, migration, `lib/actions/audit.ts`, `components/forms/audit-form.tsx` | Prevents duplicate audits on double-click / retry; `submissionKey @unique` |
| Scoped `updateMany` for edits/feedback | `lib/actions/audit.ts` | Atomic write after scope check; returns not-found if row lost |
| Write rate limiting | `lib/server/rate-limit.ts`, `audit.ts`, `interaction-config.ts` | Protects against burst writes per user (in-process; use Redis at scale) |
| P2002 handling for submission key | `lib/actions/audit.ts` | Returns existing success instead of 500 on concurrent duplicate |

**Already present (unchanged):** Prisma singleton, pg pool, `configVersion` optimistic locking, `auditCode` unique + retry, `withDbRetry`.

## Phase 2 — Frontend races

| Change | Files | Why |
|--------|-------|-----|
| Stale-request guard hook | `lib/hooks/use-stale-request-guard.ts` | Ignores outdated async responses |
| Reports date-range fetch | `components/reports/executive-report.tsx` | Prevents older range overwriting newer |
| Audit detail modal fetch | `components/audit-logs/audit-detail-modal.tsx` | Prevents rapid open/close clobbering state |

**Deferred:** Supabase Realtime (no Realtime SDK in app; SSR `revalidatePath` remains source of truth).

**Deferred:** Zustand (no duplicated cross-component fetch pain identified).

## Phase 3 — Zod validation

| Change | Files |
|--------|-------|
| Audit save/update/feedback schemas | `lib/validation/audit.ts`, `lib/actions/audit.ts` |
| Login schema | `lib/validation/auth.ts`, `lib/actions/auth.ts` |
| Report date range | `lib/validation/reports.ts`, `lib/actions/reports.ts` |
| Shared helpers | `lib/validation/common.ts` |

**Already validated:** `admin.ts`, `agents.ts`, `interaction-config.ts`, `import-users.ts`.

## Phase 4 — Zustand

Skipped — not required for current architecture.

## Phase 5 — Load resilience

| Change | Notes |
|--------|-------|
| In-memory rate limits | See Phase 1 |
| DB pool / retry | Pre-existing |

**Deferred:** Redis rate limiting, `after()` queue, full analytics payload caching.

## Phase 6 — Testing

**Deferred:** No test runner in repo. Recommended manual checks:

1. Double-click **Save to History** — only one audit row created
2. Rapidly change report date range — data matches last applied range
3. Open/close audit detail quickly — correct audit shown
4. Concurrent interaction config saves — conflict message when version mismatches

## Migration required

Run after pull:

```bash
npx prisma migrate deploy
# or: npx prisma db push
```

Adds nullable `submission_key` column with unique index on `AuditSubmission`.

## Re-enable import later

Set `IMPORT_ENABLED = true` in `lib/constants.ts` and restore sidebar nav item.
