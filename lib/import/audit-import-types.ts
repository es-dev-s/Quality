import type { AuditFormData, AuditRow, CategoryScore, ScoresMap } from "@/lib/audit/types";
import type { AuditFeedbackFields } from "@/lib/audit/feedback";

export type AuditImportTemplateOption = {
  id: string;
  name: string;
  type: string;
};

export type ParsedAuditImportRow = {
  rowNumber: number;
  auditCode: string;
  templateName: string;
  templateId: string | null;
  formData: AuditFormData;
  scores: ScoresMap;
  auditRows: AuditRow[];
  qualityPct: number;
  finalPct: number;
  grade: string;
  hasFatal: boolean;
  fatalList: string[];
  totalScored: number;
  totalMax: number;
  catScores: Record<string, CategoryScore>;
  feedback: AuditFeedbackFields & {
    agentFeedback: string;
    supervisorRemarks: string;
  };
  submittedAt: string | null;
  errors: string[];
};

export type AuditImportResult = {
  created: number;
  skipped: number;
  errors: { row: number; auditCode: string; message: string }[];
};
