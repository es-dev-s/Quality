"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileType,
  Upload,
} from "lucide-react";
import { importAuditSubmissions } from "@/lib/actions/import-audits";
import {
  buildAuditImportTemplateCsv,
  buildAuditImportTemplateXlsx,
  parseAuditImportSpreadsheet,
} from "@/lib/import/parse-audit-import";
import type {
  AuditImportTemplateOption,
  AuditImportResult,
  ParsedAuditImportRow,
} from "@/lib/import/audit-import-types";
import { AUDIT_SHEET_PREVIEW_COLUMNS } from "@/lib/import/audit-sheet-columns";
import type { ImportEntityCatalog } from "@/lib/import/import-entity-catalog";
import type { AuditTemplate } from "@/lib/audit/types";
import { cn } from "@/lib/utils";
import { LoadingZone } from "@/components/primitives/loading-zone";

type ImportFormat = "csv" | "xlsx";

type AuditImportPanelProps = {
  templates: AuditImportTemplateOption[];
  templateBodies: Record<string, AuditTemplate>;
  entityCatalog: ImportEntityCatalog;
};

function hasEntityLookupError(row: ParsedAuditImportRow): boolean {
  return row.errors.some((message) => /not found in the database/i.test(message));
}

export function AuditImportPanel({
  templates,
  templateBodies,
  entityCatalog,
}: AuditImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedAuditImportRow[]>([]);
  const [result, setResult] = useState<AuditImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, startImport] = useTransition();

  const acceptTypes =
    ".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

  const validRows = useMemo(
    () => rows.filter((row) => row.errors.length === 0),
    [rows]
  );
  const invalidCount = rows.length - validRows.length;
  const entityBlocked = useMemo(
    () => rows.some((row) => hasEntityLookupError(row)),
    [rows]
  );
  const previewFilledCount = useMemo(() => {
    if (rows.length === 0) return 0;
    const preview = rows[0]?.sheetPreview ?? {};
    return AUDIT_SHEET_PREVIEW_COLUMNS.filter((column) =>
      Boolean(preview[column]?.trim())
    ).length;
  }, [rows]);

  function resetPreview() {
    setFileName(null);
    setRows([]);
    setParseError(null);
    setResult(null);
    setImportError(null);
  }

  async function readFile(file: File) {
    setParseError(null);
    setResult(null);
    setImportError(null);
    setFileName(file.name);

    try {
      const lower = file.name.toLowerCase();
      const useExcel =
        lower.endsWith(".xlsx") ||
        lower.endsWith(".xls") ||
        (format === "xlsx" &&
          !lower.endsWith(".csv") &&
          !lower.endsWith(".tsv") &&
          !lower.endsWith(".txt"));
      const parseOptions = { entityCatalog };
      const parsed = useExcel
        ? parseAuditImportSpreadsheet(
            await file.arrayBuffer(),
            "xlsx",
            templates,
            templateBodies,
            parseOptions
          )
        : parseAuditImportSpreadsheet(
            await file.text(),
            "csv",
            templates,
            templateBodies,
            parseOptions
          );
      setRows(parsed);
    } catch (error) {
      setRows([]);
      setParseError(
        error instanceof Error ? error.message : "Could not read this file."
      );
    }
  }

  function downloadTemplate(templateFormat: ImportFormat) {
    if (templateFormat === "xlsx") {
      const blob = buildAuditImportTemplateXlsx();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "audit-import-template.xlsx";
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const blob = new Blob([buildAuditImportTemplateCsv()], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    if (entityBlocked) {
      setImportError(
        "Import blocked — every row’s Agent Name and Quality Auditor must already exist in the database. Create missing users in Settings, then re-upload."
      );
      return;
    }

    if (invalidCount > 0) {
      setImportError(
        "Import blocked — fix every invalid row first. Incomplete or corrupted rows are never imported."
      );
      return;
    }

    if (validRows.length === 0) {
      setImportError("No valid audits to import.");
      return;
    }

    setImportError(null);
    startImport(async () => {
      const response = await importAuditSubmissions(validRows, { skipExisting });
      if ("error" in response) {
        setImportError(response.error);
        return;
      }
      setResult(response);
    });
  }

  return (
    <div className="import-page">
      <div className="import-page__notice import-page__notice--info">
        <ClipboardList size={18} aria-hidden />
        <div>
          <p className="import-page__notice-title">Import audit form records</p>
          <p className="import-page__notice-text">
            Upload your Google Sheet CSV/Excel. The importer auto-detects{" "}
            <strong>Quality Auditor</strong> and <strong>Agent Name</strong>, then
            assigns them to matching users in the database. If either is missing
            in the DB, the whole import is blocked.{" "}
            <strong>Team Name</strong> is imported as-is (not validated). Fully
            empty rows are ignored. Incomplete or unmatched rows are never
            written to the database.
          </p>
        </div>
      </div>

      <section className="import-card">
        <div className="import-card__head">
          <div>
            <h2 className="import-card__title">Templates in this app</h2>
            <p className="import-card__desc">
              Match the <strong>Template</strong> column to one of these names.
            </p>
          </div>
          <div className="import-actions">
            <button
              type="button"
              className="ui-btn ui-btn--secondary ui-btn--sm"
              onClick={() => downloadTemplate("csv")}
            >
              <Download size={15} aria-hidden />
              CSV template
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--secondary ui-btn--sm"
              onClick={() => downloadTemplate("xlsx")}
            >
              <Download size={15} aria-hidden />
              Excel template
            </button>
          </div>
        </div>
        <div className="import-role-chips">
          {templates.map((template) => (
            <span key={template.id} className="import-role-chip">
              <strong>{template.name}</strong>
              <span>{template.type}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="import-card">
        <h2 className="import-card__title">File format</h2>
        <p className="import-card__desc">
          Upload CSV with these columns: Call Date, Audit Date, Quality Auditor,
          Call/Chat, Agent Name, Team Name, LOB… through Call Length. Preview shows
          every column exactly as detected from your file.
        </p>
        <div className="import-formats import-formats--two">
          {(
            [
              { id: "csv" as const, label: "CSV", hint: "Google Sheets export", icon: FileType },
              {
                id: "xlsx" as const,
                label: "Excel",
                hint: ".xlsx spreadsheet",
                icon: FileSpreadsheet,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = format === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={cn("import-format", active && "import-format--active")}
                onClick={() => setFormat(item.id)}
              >
                <span className="import-format__icon" aria-hidden>
                  <Icon size={20} />
                </span>
                <span className="import-format__label">{item.label}</span>
                <span className="import-format__hint">{item.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="import-card">
        <h2 className="import-card__title">Import options</h2>
        <div className="import-options">
          <label className="import-option import-option--checkbox">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(event) => setSkipExisting(event.target.checked)}
            />
            <span>Skip rows when Audit ID already exists</span>
          </label>
        </div>
      </section>

      <section className="import-card">
        <h2 className="import-card__title">Upload file</h2>
        <input
          ref={inputRef}
          type="file"
          className="import-file-input"
          accept={acceptTypes}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = "";
          }}
        />
        <div
          className={cn(
            "import-dropzone",
            isDragging && "import-dropzone--active"
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void readFile(file);
          }}
        >
          <Upload size={28} aria-hidden />
          <p className="import-dropzone__title">
            {fileName ? fileName : "Drop your audit export here"}
          </p>
          <p className="import-dropzone__hint">
            One row per completed audit form
          </p>
          <button
            type="button"
            className="ui-btn ui-btn--secondary ui-btn--sm"
            onClick={() => inputRef.current?.click()}
          >
            Browse files
          </button>
        </div>
        {parseError ? (
          <p className="import-inline-error">
            <AlertCircle size={16} aria-hidden />
            {parseError}
          </p>
        ) : null}
      </section>

      <LoadingZone loading={isImporting} label="Importing audits…">
        <section className="import-card">
          <div className="import-card__head">
            <div>
              <h2 className="import-card__title">CSV preview</h2>
              <p className="import-card__desc">
                {rows.length > 0
                  ? entityBlocked
                    ? `Import blocked — fix missing Agent / Quality Auditor matches (${invalidCount} issue row${invalidCount === 1 ? "" : "s"}).`
                    : `${rows.length} row${rows.length === 1 ? "" : "s"} · ${previewFilledCount}/${AUDIT_SHEET_PREVIEW_COLUMNS.length} columns detected · ${validRows.length} ready`
                  : "Upload a CSV to preview every column below."}
              </p>
            </div>
          </div>

          <div className="import-preview import-preview--audits">
            {rows.length === 0 ? (
              <div className="import-preview__empty">
                No rows loaded yet. Upload your sheet to see column-wise data.
              </div>
            ) : (
              <div className="import-preview__scroll ui-scrollbar">
                <table className="import-preview-table">
                  <thead>
                    <tr>
                      <th className="import-preview-table__sticky-col">#</th>
                      {AUDIT_SHEET_PREVIEW_COLUMNS.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const ready = row.errors.length === 0;
                      const preview = row.sheetPreview ?? {};
                      return (
                        <tr
                          key={`${row.rowNumber}-${row.auditCode}`}
                          className={cn(
                            !ready && "import-preview-table__row--invalid"
                          )}
                        >
                          <td className="import-preview-table__sticky-col">
                            {row.rowNumber}
                          </td>
                          {AUDIT_SHEET_PREVIEW_COLUMNS.map((column) => {
                            const value = preview[column] ?? "";
                            return (
                              <td
                                key={column}
                                title={value || undefined}
                                className={
                                  value.length > 28
                                    ? "import-preview-table__clamp"
                                    : undefined
                                }
                              >
                                {value || "—"}
                              </td>
                            );
                          })}
                          <td className="import-preview__status">
                            {ready ? (
                              <>
                                <CheckCircle2 size={14} aria-hidden />
                                Ready
                              </>
                            ) : (
                              <span
                                className="import-preview-table__error"
                                title={row.errors.join(" ")}
                              >
                                {row.errors.join(" · ")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {result ? (
            <div className="import-result">
              <p>
                <strong>{result.created}</strong> created ·{" "}
                <strong>{result.skipped}</strong> skipped
              </p>
              {result.errors.length > 0 ? (
                <ul className="import-result__errors">
                  {result.errors.slice(0, 8).map((item) => (
                    <li key={`${item.row}-${item.auditCode}`}>
                      Row {item.row} ({item.auditCode}): {item.message}
                    </li>
                  ))}
                  {result.errors.length > 8 ? (
                    <li>…and {result.errors.length - 8} more</li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          ) : null}

          {importError ? (
            <p className="import-inline-error">
              <AlertCircle size={16} aria-hidden />
              {importError}
            </p>
          ) : null}

          <div className="import-actions">
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={resetPreview}
              disabled={!fileName && rows.length === 0}
            >
              Reset
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--primary ui-btn--sm"
              disabled={
                validRows.length === 0 ||
                isImporting ||
                entityBlocked ||
                invalidCount > 0
              }
              onClick={handleImport}
            >
              {isImporting
                ? "Importing…"
                : `Import ${validRows.length} audit${validRows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </section>
      </LoadingZone>
    </div>
  );
}
