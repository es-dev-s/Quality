import type { Prisma } from "@prisma/client";
import {
  auditSubmissionScopeWhere,
  dataScopeFromSession,
} from "@/lib/audit/data-scope";

type SessionLike = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: {
      id: string;
      name: string;
      slug: string;
      scopes: string[];
    };
  };
};

export async function scopedAuditWhere(
  session: SessionLike,
  extra?: Prisma.AuditSubmissionWhereInput
): Promise<Prisma.AuditSubmissionWhereInput> {
  const scope = await auditSubmissionScopeWhere(dataScopeFromSession(session));

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

export async function scopedAuditByIdWhere(
  session: SessionLike,
  id: string
): Promise<Prisma.AuditSubmissionWhereInput> {
  return scopedAuditWhere(session, { id });
}
