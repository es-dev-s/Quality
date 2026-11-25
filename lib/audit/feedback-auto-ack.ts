import { DISPUTE_SLA_HOURS } from "@/lib/audit/dispute";
import { prisma } from "@/lib/prisma";
import { invalidateReadResults } from "@/lib/server/read-cache";

const THROTTLE_MS = 60_000;
let lastRun = 0;

/**
 * Auto-acknowledge shared feedback the agent did not act on within the
 * acknowledgement window. The acknowledgement is stamped at the deadline
 * (feedback date + 48h), not at the time this runs. Audits with an open
 * dispute are skipped. There is no scheduler, so this runs lazily when audits
 * or KPIs are read, at most once a minute per process.
 */
export async function autoAcknowledgeExpiredFeedback(
  now: Date = new Date(),
  { force = false }: { force?: boolean } = {}
): Promise<number> {
  if (!force && now.getTime() - lastRun < THROTTLE_MS) return 0;
  lastRun = now.getTime();

  const hours = DISPUTE_SLA_HOURS.agentAcknowledge;
  // feedbackDate is free text in legacy rows: only cast values that look like
  // dates, and never rely on AND short-circuiting (hence the CASE).
  const count = await prisma.$executeRaw`
    UPDATE "AuditSubmission" SET
      "feedbackStatus" = 'Acknowledged',
      "feedback_status_at" = to_char(
        ("feedbackDate"::timestamptz + make_interval(hours => ${hours}))
          AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    WHERE "feedbackStatus" = 'Shared'
      AND ("dispute_stage" IS NULL OR "dispute_stage" = 'CLOSED')
      AND "feedbackDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      AND CASE
        WHEN "feedbackDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          THEN "feedbackDate"::timestamptz + make_interval(hours => ${hours}) < ${now}::timestamptz
        ELSE false
      END`;
  if (count > 0) invalidateReadResults();
  return count;
}
