import type { FeedbackSecurity, FeedbackStatus } from "@/lib/audit/feedback";

export type InteractionType = "Call" | "Chat";
export type BusinessType = string;
export type { FeedbackSecurity, FeedbackStatus };

export type ScoringScheme =
  | "Y/N/Fatal/NA"
  | "Y/Fatal/NA"
  | "Y/N/NA"
  | "EE/ME/BE/NA"
  | "Y/N-CMM";

export type ScoreKey = "EE" | "ME" | "BE" | "Y" | "N" | "Fatal";

export type ParamPoints = Partial<Record<ScoreKey, number>>;

export type AuditParameter = {
  id: string;
  name: string;
  max: number;
  cat: string;
  scoring: ScoringScheme;
  /** Per-option points (spreadsheet rubric). Falls back to legacy formulas when omitted. */
  points?: ParamPoints;
  /** Selection values that trigger a scoring fatal (e.g. N, BE). */
  fatalOn?: ScoreKey[];
  /** Label for the fatal dropdown option (Y/Fatal/NA scheme). */
  fatalOptionLabel?: string;
};

export type AuditSection = {
  id: string;
  name: string;
  isFatal: boolean;
  params: AuditParameter[];
};

export type AuditTemplate = {
  id: string;
  name: string;
  type: string;
  lob: string;
  description?: string;
  isDefault: boolean;
  sections: AuditSection[];
};

export type LOBConfig = {
  name: string;
  businessType: BusinessType;
  /** Settings: Reason — audit form sublob field */
  sublobs: string[];
  /** Settings: Sub-reason — audit form reason field (flat, independent) */
  subReasonsList?: string[];
  /** Settings: DFF — audit form subReason field (flat, independent) */
  dffList?: string[];
  /** @deprecated Legacy nested storage — migrated to flat lists on read */
  sublobReasons?: Record<string, string[]>;
  sublobReasonSubReasons?: Record<string, Record<string, string[]>>;
  reasonSubReasons?: Record<string, string[]>;
  reasons?: string[];
};

export type InteractionConfig = {
  agents: string[];
  supervisors: string[];
  auditors: string[];
  businessTypes: string[];
  lobs: LOBConfig[];
};

export type AuditFormData = {
  agent: string;
  supervisor: string;
  auditor: string;
  type: InteractionType;
  businessType: BusinessType;
  callDate: string;
  auditDate: string;
  lob: string;
  sublob: string;
  mobile: string;
  /** CRM / ticket URL, uploaded audio (/uploads/audit-media/), or image (/uploads/audit-images/) */
  referenceUrl: string;
  reason: string;
  subReason: string;
  response: string;
  feedbackSecurity: FeedbackSecurity;
  feedbackStatus: FeedbackStatus;
  feedbackDate: string;
  agentFeedback: string;
};

export type AuditRow = {
  id: string;
  cat: string;
  name: string;
  max: number;
  sel: string;
  score: number;
  fatal: boolean;
  isScoringFatal?: boolean;
};

export type CategoryScore = {
  scored: number;
  max: number;
};

export type AuditRecord = AuditFormData & {
  id: string;
  savedAt: string;
  qualityPct: number;
  finalPct: number;
  grade: string;
  gc: string;
  qualityGrade: string;
  qualityGc: string;
  hasFatal: boolean;
  fatalList: string[];
  feedbackSecurity: string;
  feedbackStatus: string;
  feedbackDate: string;
  totalScored: number;
  totalMax: number;
  catScores: Record<string, CategoryScore>;
  rows: AuditRow[];
};

export type ScoresMap = Record<string, string>;
