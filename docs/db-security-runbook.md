# Database Security Runbook

This app uses **Prisma + PostgreSQL** (hosted on Supabase). There is no Supabase JS client and **no Row Level Security (RLS)**. Application-layer RBAC is the primary control; the database connection string is the second line of defense.

## Restricted application role (recommended for production)

### 1. Create a restricted Postgres user

Connect as the Supabase `postgres` user (or another admin) and run:

```sql
CREATE ROLE quality_audit_app LOGIN PASSWORD 'strong-random-password';

GRANT CONNECT ON DATABASE postgres TO quality_audit_app;
GRANT USAGE ON SCHEMA public TO quality_audit_app;

-- Tables (adjust if schema changes)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO quality_audit_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO quality_audit_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO quality_audit_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO quality_audit_app;

-- Optional: revoke DDL
REVOKE CREATE ON SCHEMA public FROM quality_audit_app;
```

Do **not** grant `SUPERUSER`, `CREATEDB`, or `BYPASSRLS`.

### 2. Update runtime `DATABASE_URL`

Point the application at the restricted user (session pooler recommended):

```env
DATABASE_URL="postgresql://quality_audit_app:PASSWORD@...pooler.supabase.com:5432/postgres?..."
DATABASE_URL_SESSION="..."  # optional; preferred for app runtime
```

Restart the app after rotating credentials.

### 3. Keep a migration-only connection

Migrations require DDL. Use a separate superuser/direct URL **only in CI and local migrate**, never in the running app:

```env
# CI / local migrations only — never set on production app runtime
DIRECT_URL="postgresql://postgres:...@db....supabase.co:5432/postgres"
MIGRATION_DATABASE_URL="postgresql://postgres:...@db....supabase.co:5432/postgres"
```

`prisma.config.ts` already prefers `DIRECT_URL` for `prisma migrate deploy`. In CI:

```bash
export DIRECT_URL="$MIGRATION_DATABASE_URL"
npx prisma migrate deploy
```

### 4. Secret rotation

If `DATABASE_URL` is leaked:

1. Rotate the restricted user password in Supabase.
2. Update env on all app instances.
3. Review audit logs for anomalous queries.
4. Consider invalidating all sessions (`AUTH_SECRET` rotation forces re-login).

## RLS deferral

Full **RLS** is deferred while the app remains Prisma-only. If you later adopt `@supabase/supabase-js` with Supabase Auth, add RLS policies per table and stop using the postgres superuser role in the browser.

## Upload storage

Audit media is stored under `storage/uploads/` (not `public/`). Files are served via authenticated routes under `/api/files/`. Run `npx tsx scripts/migrate-uploads.ts` once when upgrading from older deployments.

## Auth.js / NextAuth version

The app uses `next-auth@5.0.0-beta.31` (Auth.js v5 beta). As of this runbook, npm `latest` is v4.x; v5 GA is not published. Pin to beta until GA, then upgrade and regression-test login/session flows.
