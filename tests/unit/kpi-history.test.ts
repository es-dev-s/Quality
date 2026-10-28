import { describe, expect, it } from "vitest";
import { filterKpiRecords } from "@/lib/kpi/compute-kpi";
import { DEFAULT_KPI_FILTERS } from "@/lib/kpi/filters";
import type { KpiAuditRecord } from "@/lib/kpi/records";

function record(id: string, agent: string, isHistory: boolean): KpiAuditRecord {
  return {
    id,
    agent,
    supervisor: null,
    auditor: "QA One",
    type: "Call",
    auditType: null,
    callDate: "2026-10-10",
    auditDate: "2026-10-10",
    qualityPct: 90,
    finalPct: 90,
    hasFatal: false,
    feedbackStatus: "Pending",
    isHistory,
  };
}

describe("KPI filtering with transfer history", () => {
  const records = [
    record("w1", "Asha Rai", false),
    record("h1", "Asha Rai", true),
    record("x1", "Other Agent", false),
  ];

  it("keeps history audits in KPIs", () => {
    const rows = filterKpiRecords(records, { ...DEFAULT_KPI_FILTERS, time: "all" });
    expect(rows.map((row) => row.id)).toEqual(["w1", "h1", "x1"]);
  });

  it("scopes by QM roster including history rows", () => {
    const rows = filterKpiRecords(
      records,
      { ...DEFAULT_KPI_FILTERS, time: "all", qm: "qm-1" },
      ["asha rai"]
    );
    expect(rows.map((row) => row.id)).toEqual(["w1", "h1"]);
  });
});
