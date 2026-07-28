/**
 * Production checks for Superadmin audit import matching + sparse-row filter.
 * Run: npx tsx scripts/verify-audit-import.ts
 */
import "dotenv/config";
import {
  buildAuditSheetPreviewStrict,
  hasTooManyEmptyImportColumns,
  MAX_EMPTY_IMPORT_SIGNAL_COLUMNS,
} from "../lib/import/audit-sheet-columns";
import {
  matchAgentName,
  matchAuditorName,
  validateImportEntities,
} from "../lib/import/import-entity-catalog";
import { importRowIntegrityError } from "../lib/import/import-row-guards";
import { loadImportEntityCatalog } from "../lib/import/resolve-import-entities";
import type { ParsedAuditImportRow } from "../lib/import/audit-import-types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function ok(message: string) {
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("\nverify-audit-import\n");

  // --- Sparse row filter ---
  const sparse = buildAuditSheetPreviewStrict({
    "Agent Name": "Only Name",
  });
  assert(
    hasTooManyEmptyImportColumns(sparse),
    "sparse row should be blocked"
  );
  ok(`sparse rows blocked (max empty signal cols = ${MAX_EMPTY_IMPORT_SIGNAL_COLUMNS})`);

  const complete = buildAuditSheetPreviewStrict({
    "Call Date": "2024-01-01",
    "Audit Date": "2024-01-02",
    "Quality Auditor": "QA Person",
    "Call/Chat": "Call",
    "Agent Name": "Agent Person",
    "Team Name": "Team A",
    LOB: "Sales",
    "Sub-LOB": "Inbound",
    "Overall Score (With Fatal)": "88",
    "Feedback Status": "Pending",
  });
  assert(
    !hasTooManyEmptyImportColumns(complete),
    "complete row should pass empty-column gate"
  );
  ok("complete signal rows accepted");

  assert(
    hasTooManyEmptyImportColumns(null),
    "missing preview must block on server"
  );
  ok("null preview blocked (server harden)");

  // --- Live catalog (DB) ---
  const catalog = await loadImportEntityCatalog();
  assert(catalog.agents.length > 0, "agent catalog should not be empty");
  assert(catalog.auditors.length > 0, "auditor catalog should not be empty");
  ok(
    `catalog loaded — agents=${catalog.agents.length}, auditors=${catalog.auditors.length}`
  );

  const sampleAgent = catalog.agents[0]!;
  const sampleAuditor = catalog.auditors[0]!;
  assert(
    matchAgentName(sampleAgent.name, catalog)?.name === sampleAgent.name,
    "agent name match"
  );
  assert(
    matchAuditorName(sampleAuditor.name, catalog)?.name === sampleAuditor.name,
    "auditor name match"
  );
  ok("agent + auditor name matching works");

  // Roster-only style: if an agent entry exists, matching must succeed.
  const rosterLike = catalog.agents.find((entry) =>
    entry.id.startsWith("cm")
  );
  if (rosterLike) {
    assert(matchAgentName(rosterLike.name, catalog), "roster/user agent match");
    ok(`matched catalog agent "${rosterLike.name}"`);
  }

  const entityOk = validateImportEntities(
    [
      {
        rowNumber: 1,
        agent: sampleAgent.name,
        auditor: sampleAuditor.name,
        teamName: "Any Team",
      },
    ],
    catalog
  );
  assert(entityOk.ok, "entity validation should pass for catalog names");
  ok("entity validation passes for known names");

  const entityBad = validateImportEntities(
    [
      {
        rowNumber: 1,
        agent: "__missing_agent_xyz__",
        auditor: sampleAuditor.name,
        teamName: "",
      },
    ],
    catalog
  );
  assert(!entityBad.ok, "unknown agent must fail entity validation");
  ok("unknown agent blocked");

  // Integrity uses formData fallback when sheetPreview is sparse/missing keys.
  const integrityRow = {
    rowNumber: 1,
    auditCode: "AUD-TEST-1",
    templateName: "Call",
    templateId: "tmpl",
    formData: {
      agent: sampleAgent.name,
      supervisor: "Team",
      auditor: sampleAuditor.name,
      type: "Call" as const,
      auditType: "BAU Audit" as const,
      businessType: "",
      callDate: "2024-01-01",
      auditDate: "2024-01-02",
      lob: "Sales",
      sublob: "Inbound",
      mobile: "",
      referenceUrl: "",
      reason: "",
      subReason: "",
      response: "",
      feedbackSecurity: "NA",
      feedbackStatus: "Pending",
      feedbackDate: "",
      agentFeedback: "",
    },
    scores: { p1: "Yes" },
    auditRows: [
      {
        id: "p1",
        cat: "A",
        name: "P",
        max: 1,
        sel: "Yes",
        score: 1,
        fatal: false,
      },
    ],
    qualityPct: 90,
    finalPct: 90,
    grade: "A",
    hasFatal: false,
    fatalList: [],
    totalScored: 1,
    totalMax: 1,
    catScores: { A: { scored: 1, max: 1 } },
    feedback: {
      feedbackSecurity: "NA",
      feedbackStatus: "Pending",
      feedbackDate: "",
      agentFeedback: "",
      supervisorRemarks: "",
    },
    submittedAt: null,
    sheetPreview: complete,
    errors: [],
  } satisfies ParsedAuditImportRow;

  assert(
    importRowIntegrityError(integrityRow) === null,
    `integrity should pass, got: ${importRowIntegrityError(integrityRow)}`
  );
  ok("importRowIntegrityError passes complete row");

  const sparseIntegrity = {
    ...integrityRow,
    formData: {
      ...integrityRow.formData,
      agent: "",
      auditor: "",
      callDate: "",
      auditDate: "",
      lob: "",
      sublob: "",
      feedbackStatus: "",
      type: "Call" as const,
      auditType: "",
      supervisor: "",
    },
    sheetPreview: sparse,
    qualityPct: 0,
    grade: "",
    scores: {},
    auditRows: [],
    totalMax: 0,
    errors: [],
  } satisfies ParsedAuditImportRow;

  assert(
    importRowIntegrityError(sparseIntegrity) !== null,
    "sparse integrity row must fail"
  );
  ok("importRowIntegrityError blocks sparse row");

  console.log("\nAll audit import checks passed.\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
