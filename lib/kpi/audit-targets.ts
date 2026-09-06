import {
  KPI_DEFAULT_AGENT_TARGET,
} from "@/lib/kpi/records";
import {
  getSystemMeta,
  setSystemMeta,
} from "@/lib/db/system-meta";

export const META_AUDIT_TARGET_PER_AGENT = "audit_target_per_agent";
export const META_AUDIT_TARGET_TOTAL_MONTHLY = "audit_target_total_monthly";

export function perAgentTargetKey(userId: string): string {
  return `${META_AUDIT_TARGET_PER_AGENT}:${userId}`;
}

export function totalMonthlyTargetKey(userId: string): string {
  return `${META_AUDIT_TARGET_TOTAL_MONTHLY}:${userId}`;
}

const PER_AGENT_MIN = 1;
const PER_AGENT_MAX = 999;
const TOTAL_MONTHLY_MIN = 1;
const TOTAL_MONTHLY_MAX = 99_999;

export type AuditTargets = {
  perAgent: number;
  totalMonthly: number | null;
};

function parsePositiveInt(
  raw: string | null,
  min: number,
  max: number
): number | null {
  if (raw == null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

export function clampAuditTargetPerAgent(value: number): number {
  if (!Number.isFinite(value)) return KPI_DEFAULT_AGENT_TARGET;
  return Math.min(PER_AGENT_MAX, Math.max(PER_AGENT_MIN, Math.round(value)));
}

export function clampAuditTargetTotalMonthly(value: number): number {
  if (!Number.isFinite(value)) return TOTAL_MONTHLY_MIN;
  return Math.min(
    TOTAL_MONTHLY_MAX,
    Math.max(TOTAL_MONTHLY_MIN, Math.round(value))
  );
}

async function resolveOwnedMetaValue(
  personalKey: string,
  legacyKey: string,
  min: number,
  max: number
): Promise<string | null> {
  const personal = await getSystemMeta(personalKey);
  const parsedPersonal = parsePositiveInt(personal, min, max);
  if (parsedPersonal != null) return String(parsedPersonal);

  const legacy = parsePositiveInt(await getSystemMeta(legacyKey), min, max);
  if (legacy == null) return null;

  // One-time copy so this user owns the value and later edits stay private.
  await setSystemMeta(personalKey, String(legacy));
  return String(legacy);
}

export async function readAuditTargets(userId: string): Promise<AuditTargets> {
  const [perAgentRaw, totalMonthlyRaw] = await Promise.all([
    resolveOwnedMetaValue(
      perAgentTargetKey(userId),
      META_AUDIT_TARGET_PER_AGENT,
      PER_AGENT_MIN,
      PER_AGENT_MAX
    ),
    resolveOwnedMetaValue(
      totalMonthlyTargetKey(userId),
      META_AUDIT_TARGET_TOTAL_MONTHLY,
      TOTAL_MONTHLY_MIN,
      TOTAL_MONTHLY_MAX
    ),
  ]);

  return {
    perAgent:
      parsePositiveInt(perAgentRaw, PER_AGENT_MIN, PER_AGENT_MAX) ??
      KPI_DEFAULT_AGENT_TARGET,
    totalMonthly: parsePositiveInt(
      totalMonthlyRaw,
      TOTAL_MONTHLY_MIN,
      TOTAL_MONTHLY_MAX
    ),
  };
}

export async function writeAuditTargetPerAgent(
  userId: string,
  value: number
): Promise<number> {
  const next = clampAuditTargetPerAgent(value);
  await setSystemMeta(perAgentTargetKey(userId), String(next));
  return next;
}

export async function writeAuditTargetTotalMonthly(
  userId: string,
  value: number
): Promise<number> {
  const next = clampAuditTargetTotalMonthly(value);
  await setSystemMeta(totalMonthlyTargetKey(userId), String(next));
  return next;
}
