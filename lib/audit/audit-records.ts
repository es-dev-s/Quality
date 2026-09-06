import type { FeedbackSecurity, FeedbackStatus } from "@/lib/audit/feedback";
import type { AuditSourceKind } from "@/lib/audit/audit-source";
import type {
  AuditFormData,
  AuditRow,
  CategoryScore,
  ScoresMap,
} from "@/lib/audit/types";

/** Saved audit row for audit logs table and exports. */
export type AuditLogEntry = {
  id: string;
  auditCode: string;
  agent: string;
  supervisor: string | null;
  lob: string;
  sublob: string | null;
  reason: string | null;
  type: string;
  businessType: string;
  auditType: string;
  callDate: string;
  auditDate: string;
  auditor: string | null;
  qualityPct: number;
  finalPct: number;
  grade: string;
  hasFatal: boolean;
  feedbackSecurity: FeedbackSecurity;
  feedbackStatus: FeedbackStatus;
  feedbackDate: string | null;
  feedbackStatusAt: string | null;
  agentFeedback: string;
  supervisorRemarks: string;
  mobile: string | null;
  referenceUrl: string | null;
  submittedBy: string;
  /** Role slug of the user who submitted the form (for source tagging). */
  submittedByRoleSlug: string | null;
  /** Derived source tag: supervisor | qa | other */
  auditSource: AuditSourceKind;
  createdAt: string;
  isHistory: boolean;
};

/** Full audit detail for the view modal. */
export type AuditDetail = {
  id: string;
  auditCode: string;
  agent: string;
  supervisor: string | null;
  auditor: string | null;
  type: string;
  businessType: string;
  auditType: string;
  callDate: string;
  auditDate: string;
  lob: string;
  sublob: string | null;
  reason: string | null;
  subReason: string | null;
  mobile: string | null;
  referenceUrl: string | null;
  response: string | null;
  qualityPct: number;
  finalPct: number;
  grade: string;
  hasFatal: boolean;
  fatalList: string[];
  feedbackSecurity: FeedbackSecurity;
  feedbackStatus: FeedbackStatus;
  feedbackDate: string | null;
  feedbackStatusAt: string | null;
  agentFeedback: string;
  supervisorRemarks: string;
  totalScored: number;
  totalMax: number;
  catScores: Record<string, CategoryScore>;
  rows: AuditRow[];
  submittedBy: string;
  submittedByRoleSlug: string | null;
  auditSource: AuditSourceKind;
  createdAt: string;
  isHistory: boolean;
};

export type AuditEditPayload = {
  id: string;
  auditCode: string;
  templateId: string;
  formData: AuditFormData;
  scores: ScoresMap;
};

export type DashboardAuditRecord = {
  id: string;
  auditCode: string;
  agent: string;
  supervisor: string | null;
  auditor: string | null;
  lob: string;
  type: string;
  businessType: string;
  callDate: string;
  auditDate: string;
  qualityPct: number;
  finalPct: number;
  hasFatal: boolean;
  fatalList: string[];
  isHistory: boolean;
  auditSource: AuditSourceKind;
};

export type DashboardAuditData = {
  records: DashboardAuditRecord[];
  rosterAgentNames: string[];
  fetchedAt: string;
  dbError: string | null;
  agentTarget: number;
  totalMonthlyTarget: number | null;
};
