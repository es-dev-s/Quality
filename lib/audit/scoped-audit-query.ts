import type { Prisma } from "@prisma/client";
import {
  auditSubmissionScopeWhere,
  dataScopeFromSession,
} from "@/lib/audit/data-scope";

type SessionLike = {
  user: {
    id: string;
    name?: string | null;
    role: {
      id: string;
      name: string;
      slug: string;
      scopes: string[];
    };
  };
};

export function scopedAuditWhere(
  session: SessionLike,
  extra?: Prisma.AuditSubmissionWhereInput
): Prisma.AuditSubmissionWhereInput {
  const scope = auditSubmissionScopeWhere(dataScopeFromSession(session));

  if (!scope && !extra) {
    return {};
  }
  if (!scope) {
    return extra!;
  }
  if (!extra) {
    return scope;
  }
  return { AND: [scope, extra] };
}

export function scopedAuditByIdWhere(
  session: SessionLike,
  id: string
): Prisma.AuditSubmissionWhereInput {
  return scopedAuditWhere(session, { id });
}
