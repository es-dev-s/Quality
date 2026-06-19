import type { Prisma } from "@prisma/client";

export const AUDIT_LOG_LIST_SELECT = {
  id: true,
  auditCode: true,
  agent: true,
  supervisor: true,
  lob: true,
  sublob: true,
  reason: true,
  type: true,
  businessType: true,
  callDate: true,
  auditDate: true,
  auditor: true,
  qualityPct: true,
  finalPct: true,
  grade: true,
  hasFatal: true,
  feedbackSecurity: true,
  feedbackStatus: true,
  feedbackDate: true,
  feedbackStatusAt: true,
  agentFeedback: true,
  supervisorRemarks: true,
  createdAt: true,
  submittedBy: { select: { name: true, email: true } },
} satisfies Prisma.AuditSubmissionSelect;

export const AUDIT_DASHBOARD_SELECT = {
  id: true,
  auditCode: true,
  agent: true,
  supervisor: true,
  auditor: true,
  lob: true,
  type: true,
  callDate: true,
  auditDate: true,
  qualityPct: true,
  finalPct: true,
  hasFatal: true,
  fatalList: true,
} satisfies Prisma.AuditSubmissionSelect;

export const AUDIT_CURSOR_SELECT = {
  id: true,
  auditCode: true,
  auditDate: true,
  auditor: true,
  finalPct: true,
  feedbackStatus: true,
  createdAt: true,
  agent: true,
  type: true,
  grade: true,
  hasFatal: true,
  template: { select: { id: true, name: true } },
  submittedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AuditSubmissionSelect;

export const USER_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  approvalStatus: true,
  createdAt: true,
  dateOfJoining: true,
  roleId: true,
  role: { select: { id: true, name: true, slug: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

export const AGENT_PICKER_SELECT = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;
