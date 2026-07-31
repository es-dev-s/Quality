/** Matches dashboard default “Audit target — per agent”. */
export const KPI_DEFAULT_AGENT_TARGET = 20;

/** Slim audit row used for Superadmin KPI workbook metrics. */
export type KpiAuditRecord = {
  id: string;
  agent: string;
  supervisor: string | null;
  auditor: string | null;
  type: string;
  auditType: string | null;
  callDate: string;
  auditDate: string;
  qualityPct: number;
  finalPct: number;
  hasFatal: boolean;
  feedbackStatus: string;
  isHistory?: boolean;
};

export type KpiPageData = {
  records: KpiAuditRecord[];
  rosterAgentNames: string[];
  /** Same default as dashboard “Audit target — per agent”. */
  targetPerAgent: number;
  fetchedAt: string;
};
