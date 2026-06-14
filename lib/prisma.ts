import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool, type PoolConfig } from "pg";
import {
  describeDatabaseHost,
  resolveDatabaseUrl,
} from "@/lib/db/resolve-database-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
  pgPoolConnectionString?: string;
};

const REQUIRED_DELEGATES = [
  "auditSubmission",
  "formTemplate",
  "userTemplatePreference",
  "roleFormTemplate",
  "interactionConfig",
  "agent",
  "systemMeta",
] as const;

function poolMaxConnections(): number {
  const parsed = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return 3;
}

function getPgPool(): Pool {
  const connectionString = resolveDatabaseUrl();

  if (
    globalForPrisma.pgPool &&
    globalForPrisma.pgPoolConnectionString === connectionString
  ) {
    return globalForPrisma.pgPool;
  }

  if (globalForPrisma.pgPool) {
    void globalForPrisma.pgPool.end().catch(() => undefined);
    globalForPrisma.pgPool = undefined;
    globalForPrisma.prisma = undefined;
  }

  console.info(
    `[prisma] Database target: ${describeDatabaseHost(connectionString)}`
  );

  const poolConfig: PoolConfig = {
    connectionString,
    max: poolMaxConnections(),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000,
  };

  const pool = new Pool(poolConfig);

  pool.on("error", (error) => {
    console.error("[prisma] pg pool error:", error.message);
  });

  globalForPrisma.pgPool = pool;
  globalForPrisma.pgPoolConnectionString = connectionString;
  return pool;
}

function isCurrentPrismaClient(client: PrismaClient): boolean {
  return REQUIRED_DELEGATES.every((key) => key in client);
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && isCurrentPrismaClient(cached)) {
    return cached;
  }

  const adapter = new PrismaPg(getPgPool());
  const client = new PrismaClient({ adapter });
  globalForPrisma.prisma = client;
  return client;
}

/** Lazy proxy so dev hot-reload always uses a client that matches the current schema. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
