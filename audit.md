# Phase 0 — Production Readiness Audit

Generated for the Quality Audit Next.js app. **Read-only inventory** before hardening (see `CHANGES.md` for fixes applied).

## Architecture Summary

| Layer | Implementation |
|-------|----------------|
| Framework | Next.js 16, React 19, App Router |
| Auth | NextAuth v5 (JWT), Credentials provider |
| Data | Prisma 7 + PostgreSQL (Supabase-hosted) |
| API surface | **1** Route Handler (`/api/auth/[...nextauth]`) + **Server Actions** in `lib/actions/` |
| Realtime | **None** — no Supabase Realtime SDK, no RLS |
| Client data | Server Components + `revalidatePath`; client `useEffect` + Server Actions on Reports & audit detail modal |

## Server Actions Inventory

| Module | Actions | Write? | Zod (pre-hardening) |
|--------|---------|--------|---------------------|
| `audit.ts` | save/update audit, feedback, reads | Yes | No |
| `templates.ts` | template CRUD, preferences | Yes | Partial |
| `interaction-config.ts` | save config | Yes | Yes |
| `admin.ts` | users, roles CRUD | Yes | Yes |
| `agents.ts` | agent roster | Yes | Yes |
| `import-users.ts` | bulk import | Yes (disabled) | Yes |
| `auth.ts` | login | Yes | No |
| `analytics.ts` | read aggregation | No | N/A |
| `reports.ts` | read by date range | No | No |

## Prisma Models — Race-Relevant Fields

| Model | Hotspot | Existing guard |
|-------|---------|----------------|
| `AuditSubmission` | Create on save; update on edit/feedback | `auditCode @unique`; retry on collision |
| `InteractionConfig` | Concurrent settings saves | `configVersion` + conditional `updateMany` |
| `User` | Create/import | `email @unique` |
| `Role` | Create | `slug @unique` |
| `Agent` | Create | `nameKey @unique` |
| `RoleFormTemplate` | Template role sync | Transaction deleteMany + createMany |

**No counters, balances, or claim/assign booking fields** in schema.

## Read-Then-Write Hotspots

| Location | Pattern | Risk | Fix strategy |
|----------|---------|------|--------------|
| `saveAuditSubmission` | validate → create | Double-click duplicate audits | Idempotency key + `submissionKey @unique` |
| `updateAuditSubmission` | findFirst (scope) → update | Last-write-wins (acceptable for edits) | Scoped `updateMany`; count check |
| `updateAuditFeedback` | findFirst → update | Lost update on concurrent feedback | Scoped `updateMany` |
| `saveInteractionConfig` | updateMany without version | Silent overwrite if version omitted | Client already sends `expectedVersion` |
| `importUsers` | loop create/update | Duplicate users | `email @unique` + P2002 handling |

## Client Fetch / Race Patterns

| Component | Pattern | Risk |
|-----------|---------|------|
| `ExecutiveReport` | `useEffect` → `getReportData` | Stale range response overwrites newer |
| `AuditDetailModal` | `useEffect` → `getAuditDetail` | Rapid open/close clobbers state |
| `AuditLogsTable` | Server props + local optimistic feedback | Low — local patch then server |
| `DashboardAnalytics` | Server props, client filter only | Low |

## In-Memory / Singleton State

| Location | Purpose |
|----------|---------|
| `lib/prisma.ts` | Prisma + pg Pool singleton (correct) |
| `lib/audit/interaction-config-db.ts` | `unstable_cache` for config reads |
| No module-level write caches | — |

## Supabase

- **Database only** via `DATABASE_URL` / pooler (`lib/db/resolve-database-url.ts`)
- **No** Supabase Auth, Realtime, or RLS in app code
- Phase 2 Realtime deferred — would require new client integration; SSR revalidation remains source of truth

## Connection Pooling

- Singleton Prisma + pg `Pool` in `lib/prisma.ts`
- `DATABASE_POOL_MAX` (default 3) per instance
- Migrations use direct URL via `prisma.config.ts`

## N+1 / Load Notes

- Analytics/reports load full scoped audit sets (500+ rows JSON) — payload size > N+1
- Dashboard metrics computed in-memory after single `findMany`
- `withDbRetry` handles transient connection errors

## Test Coverage (pre-hardening)

- **No automated tests** in repo
- Manual regression + concurrency scripts recommended (Phase 6)

## Hardening Priority (implemented in CHANGES.md)

1. Idempotency + unique `submissionKey` on audit create
2. Zod at Server Action boundaries (audit, auth, reports)
3. Scoped atomic `updateMany` for feedback updates
4. In-memory rate limiting on write actions
5. Stale-request guards on client fetches
6. Deferred: Supabase Realtime, Zustand, Redis rate limit, full test suite
