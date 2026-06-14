import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use direct connection for migrations (Supabase pooler does not support DDL)
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
