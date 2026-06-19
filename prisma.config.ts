import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use direct connection for migrations (Supabase pooler does not support DDL).
    // In CI, set DIRECT_URL or MIGRATION_DATABASE_URL — see docs/db-security-runbook.md
    url: process.env["MIGRATION_DATABASE_URL"] ?? process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
