export interface Parameter {
  id: string;
  name: string;
  max: number;
  cat: string;
  scoring: "Y/N/Fatal/NA" | "Y/N/NA" | "EE/ME/BE/NA" | "Y/N-CMM" | "1-5" | "1-10";
}

export interface Section {
  id: string;
  name: string;
  isFatal: boolean;
  params: Parameter[];
}

export interface AuditTemplate {
  id: string;
  name: string;
  type: string;
  lob: string;
  desc: string;
  isDefault: boolean;
  sections: Section[];
  createdAt: string;
}

export interface AuditRow {
  id: string;
  cat: string;
  name: string;
  max: number;
  sel: string;
  score: number;
  fatal: boolean;
  isScoringFatal?: boolean;
}

export interface AuditRecord {
  id: string | number;
  savedAt: string;
  agent: string;
  supervisor: string;
  auditor: string;
  type: "Call" | "Chat";
  businessType?: "Sales" | "Support";
  callDate: string;
  auditDate: string;
  lob: string;
  sublob: string;
  mobile: string;
  reason: string;
  response: string;
  qualityPct: number;
  finalPct: number;
  grade: string;
  gc: string;
  qualityGrade: string;
  qualityGc: string;
  hasFatal: boolean;
  fatalList: string[];
  feedbackStatus?: "Pending" | "Shared" | "Acknowledged" | "Disputed";
  totalScored: number;
  totalMax: number;
  catScores: Record<string, { scored: number; max: number }>;
  rows: AuditRow[];
}

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: "Admin" | "Quality Manager" | "Quality Supervisor" | "Quality Agent";
  status: "active" | "pending" | "suspended";
  pwdHash: string;
  viewAll: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  allowedMenus: string[];
  createdAt: string;
  lastLogin: string;
}

export interface LOBConfig {
  name: string;
  sublobs: string[];
  reasons: string[];
  businessType?: 'Sales' | 'Support';
  sublobReasons?: Record<string, string[]>;
}

export interface InteractionConfig {
  agents: string[];
  supervisors: string[];
  auditors: string[];
  lobs: LOBConfig[];
}
