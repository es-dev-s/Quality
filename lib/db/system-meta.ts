import { prisma } from "@/lib/prisma";

export const META_AGENTS_INITIALIZED = "agents_initialized";

export async function getSystemMeta(key: string): Promise<string | null> {
  const row = await prisma.systemMeta.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSystemMeta(key: string, value: string): Promise<void> {
  await prisma.systemMeta.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function isAgentsInitialized(): Promise<boolean> {
  return (await getSystemMeta(META_AGENTS_INITIALIZED)) === "true";
}

export async function markAgentsInitialized(): Promise<void> {
  await setSystemMeta(META_AGENTS_INITIALIZED, "true");
}
