# Production Readiness Plan — Next.js + Prisma + Supabase

## Goal
Make the existing Next.js app production-grade: zero race conditions (frontend, backend, DB), instant/realtime UI updates, and stable handling of 100+ concurrent users/events — **without changing existing functionality, business logic, UI, or routes.** This is a hardening pass, not a rewrite.

## Hard Rules for Cursor
1. Do not change feature behavior, UI, copy, routes, or API contracts unless strictly required to fix a race condition or crash.
2. Every change must be additive/refactor-safe. Run the app and existing tests after each phase.
3. No new heavy dependencies unless explicitly approved (Zod and lightweight client state are pre-approved — see Phase 3 & 4).
4. Work in small, isolated commits per phase so changes are reviewable and revertible.

---

## Phase 0 — Audit & Inventory (Read-only, no edits)
Cursor must first map the codebase before touching anything:
- List all API routes / Route Handlers (`app/api/**/route.ts`) and Server Actions.
- List all Prisma models, especially ones with counters, balances, statuses, or "claim/assign/booking" style fields (race-condition hotspots).
- List all places doing **read-then-write** patterns (fetch a row, check a condition, then update) — these are the primary race condition sources.
- List all client-side data fetching: `useEffect` + `fetch`, SWR, React Query, or raw `fetch` in components.
- List all places mutating shared/global state without locks (in-memory caches, module-level variables, singletons).
- Identify any use of `Promise.all` over writes to the same row/resource.
- Identify Supabase usage: are Realtime subscriptions used anywhere? Are RLS policies enabled?
- Output this audit as `audit.md` before making any code changes. Do not proceed to Phase 1 until audit is reviewed.

---

## Phase 1 — Backend Race Conditions (Prisma + Postgres)

### 1.1 Replace read-then-write with atomic operations
For every hotspot identified in Phase 0:
- Replace `SELECT` then `UPDATE` patterns with Prisma's atomic update operators (`increment`, `decrement`, `set` with conditional `where`).
- For "claim this resource if available" patterns, use a single conditional `UPDATE ... WHERE status = 'available'` and check `updatedRow` / `count` to detect if it was already taken — never check-then-act in two queries.

### 1.2 Use database transactions correctly
- Wrap any multi-step write (e.g., create order + decrement stock + create payment record) in `prisma.$transaction([...])` or interactive transactions (`prisma.$transaction(async (tx) => {...})`).
- Set appropriate isolation level (`Serializable` or `RepeatableRead`) for transactions that read-then-write within the transaction itself.
- Add row-level locking where Postgres supports it: use `SELECT ... FOR UPDATE` via `tx.$queryRaw` for critical sections Prisma can't express atomically.

### 1.3 Unique constraints as guardrails
- For anything that must not be duplicated (e.g., one-vote-per-user, one-active-session, idempotent payment), ensure a DB-level `@@unique` constraint exists in `schema.prisma` so concurrent requests fail safely at the DB instead of creating duplicates.
- Catch the resulting Prisma `P2002` unique constraint error and return a clean "already exists / already processed" response — never a 500.

### 1.4 Idempotency for write endpoints
- For POST/PATCH endpoints that can be retried by the client (e.g., on network blips), add idempotency key support: client sends a key, server checks if a record with that key already exists before processing.

### 1.5 Connection pooling for Supabase + Prisma
- Verify `DATABASE_URL` uses the Supabase **pooled** connection (port 6543, pgbouncer) for the app, and a **direct** connection (port 5432) only for migrations.
- Confirm Prisma client is instantiated as a singleton (one global instance, not re-created per request) to avoid connection exhaustion under concurrent load — standard Next.js Prisma singleton pattern in `lib/prisma.ts`.
- Set `connection_limit` appropriately on the pooled URL based on expected concurrency (e.g., `?connection_limit=10` per serverless instance).

---

## Phase 2 — Realtime, Instant Data Display

### 2.1 Supabase Realtime for live updates
- For data that needs to appear instantly across users (new items, status changes), enable Supabase Realtime (Postgres Changes / Broadcast) on the relevant tables.
- Subscribe on the client to relevant channels and merge incoming changes into local UI state without a full refetch.
- Ensure subscriptions are cleaned up (`unsubscribe`) on component unmount to prevent memory leaks and duplicate handlers under concurrent navigation.

### 2.2 Optimistic UI updates (no waiting for server)
- For user-initiated actions (create, update, delete, toggle), update the UI immediately (optimistic update), then reconcile with the server response.
- On server error, roll back the optimistic change and show an error — never leave UI in an inconsistent state.
- Use React's `useOptimistic` (if on React 19/Next 15) or a small reducer-based optimistic pattern if on older versions — pick whichever matches the current Next.js/React version in the project (Cursor should check `package.json` first).

### 2.3 Avoid duplicate/overlapping fetches (frontend race conditions)
- Any `useEffect` that fetches data based on changing params (search, filters, pagination, IDs) must:
  - Use an `AbortController` to cancel the previous in-flight request when params change or component unmounts.
  - Or use a request-sequencing guard (ignore stale responses by comparing a request ID/timestamp).
- This prevents the classic bug where a fast user action causes an older response to overwrite newer data ("response from request A arrives after request B and clobbers it").

### 2.4 Revalidation strategy
- Decide and standardize: Server Components + `revalidatePath`/`revalidateTag` for SSR data vs. client-side Realtime/polling for live widgets. Don't mix uncoordinated polling and Realtime on the same data — pick one source of truth per dataset to avoid flicker/race between two update paths.

---

## Phase 3 — Validation Layer (Zod)

- Add Zod schemas for every API route's input (body, query params, route params) and every Server Action's arguments.
- Validate at the boundary (top of the handler) before any DB call — invalid requests should fail fast with 400, never reach Prisma.
- Reuse the same Zod schema on the client for form validation where applicable (single source of truth), but server-side validation is mandatory regardless of client validation.
- Type inference: derive TypeScript types from Zod schemas (`z.infer<typeof schema>`) instead of maintaining duplicate manual types.

---

## Phase 4 — Lightweight Client State (Zustand)

- Introduce Zustand **only** for state that is currently:
  - Duplicated via prop-drilling across many components, or
  - Causing redundant fetches because multiple components independently fetch the same data.
- Do not migrate all state — only shared/cross-component state where it reduces redundant network calls or fixes inconsistent UI from multiple independent fetches of the same resource.
- Combine with Realtime subscriptions from Phase 2: Realtime events update the Zustand store once; all subscribed components re-render consistently (single source of truth, no per-component race between their own fetch and the realtime event).

---

## Phase 5 — Concurrency & Load Resilience (100+ concurrent users)

### 5.1 Rate limiting
- Add per-IP / per-user rate limiting on write-heavy or expensive endpoints (e.g., using Upstash Redis or a simple token-bucket if no Redis available) to prevent a burst from one client degrading service for others.

### 5.2 Timeouts & graceful failure
- Set sane timeouts on outbound calls (DB queries, third-party APIs) so one slow dependency doesn't hold a serverless function open and exhaust concurrency limits.
- Wrap all API routes in try/catch returning structured error responses (never unhandled 500s/crashes).

### 5.3 N+1 query elimination
- Audit Prisma queries for N+1 patterns (loop with `await prisma.x.findUnique` inside) and replace with `include`/`select` relations or batched `findMany` + in-memory join. Critical for staying responsive under load.

### 5.4 Caching for read-heavy endpoints
- For data that doesn't need to be realtime (reference/lookup data, infrequently-changing lists), add caching (`fetch` with Next.js cache options, `unstable_cache`, or Redis) to reduce DB load under concurrent traffic.

### 5.5 Background work off the request path
- Any slow operation triggered by a user action (emails, notifications, heavy computation) should be queued/deferred (e.g., via a queue, or `after()` in Next.js) rather than blocking the response — keeps request handling fast under concurrency.

---

## Phase 6 — Testing & Verification

- For each fixed race-condition hotspot, write a test that simulates concurrent requests (e.g., `Promise.all` of N identical requests) and asserts only one succeeds / the final state is consistent.
- Manually verify: rapid double-click on action buttons doesn't create duplicates (covered by idempotency + unique constraints).
- Load test critical endpoints with a tool like `autocannon` or `k6` at ~100 concurrent connections; confirm no errors, acceptable latency, and stable DB connection count.
- Verify Realtime updates appear across two browser sessions instantly without manual refresh.
- Full regression pass on existing functionality — confirm no UI/behavior changed, only robustness improved.

---

## Deliverables Cursor Should Produce
1. `audit.md` — Phase 0 findings (review before proceeding).
2. Code changes organized by phase, each in its own commit/PR with a short description of the race condition or issue fixed.
3. A short `CHANGES.md` summarizing every fix made, the file(s) touched, and why — for review against "no functionality changed" requirement.
