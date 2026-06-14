"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  FileType,
  Upload,
  Users,
} from "lucide-react";
import { importUsers } from "@/lib/actions/import-users";
import {
  buildUserImportTemplateCsv,
  parseUserImportFile,
} from "@/lib/import/parse-user-import";
import type {
  ParsedUserImportRow,
  RoleImportOption,
  UserImportResult,
} from "@/lib/import/user-import-types";
import { cn } from "@/lib/utils";

type ImportFormat = "csv" | "json";

type DataImportPanelProps = {
  roles: RoleImportOption[];
};

export function DataImportPanel({ roles }: DataImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [defaultPassword, setDefaultPassword] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedUserImportRow[]>([]);
  const [result, setResult] = useState<UserImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, startImport] = useTransition();

  const acceptByFormat: Record<ImportFormat, string> = {
    csv: ".csv,text/csv",
    json: ".json,application/json",
  };

  const validRows = useMemo(
    () => rows.filter((row) => row.errors.length === 0),
    [rows]
  );
  const invalidCount = rows.length - validRows.length;

  function resetPreview() {
    setFileName(null);
    setRows([]);
    setParseError(null);
    setResult(null);
    setImportError(null);
  }

  function handleBrowse() {
    inputRef.current?.click();
  }

  async function readFile(file: File) {
    setParseError(null);
    setResult(null);
    setImportError(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsed = parseUserImportFile(text, format, {
        defaultPassword,
        requirePassword: !defaultPassword.trim(),
      });
      setRows(parsed);
    } catch (error) {
      setRows([]);
      setParseError(
        error instanceof Error ? error.message : "Could not read this file."
      );
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void readFile(file);
    }
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void readFile(file);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([buildUserImportTemplateCsv()], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "user-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    if (validRows.length === 0) {
      setImportError("Fix validation errors before importing.");
      return;
    }

    setImportError(null);
    startImport(async () => {
      const response = await importUsers(
        validRows.map(({ name, email, password, role }) => ({
          name,
          email,
          password,
          role,
        })),
        { updateExisting }
      );

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
        <Users size={18} aria-hidden />
        <div>
          <p className="import-page__notice-title">Import users with roles</p>
          <p className="import-page__notice-text">
            Upload a CSV or JSON file with name, email, password, and role. Roles
            are matched by name or slug from your existing access setup.
          </p>
        </div>
      </div>

      <section className="import-card">
        <div className="import-card__head">
          <div>
            <h2 className="import-card__title">Available roles</h2>
            <p className="import-card__desc">
              Use one of these values in the <strong>role</strong> column.
            </p>
          </div>
          <button
            type="button"
            className="ui-btn ui-btn--secondary ui-btn--sm"
            onClick={downloadTemplate}
          >
            <Download size={15} aria-hidden />
            Download template
          </button>
        </div>
        <div className="import-role-chips">
          {roles.map((role) => (
            <span key={role.id} className="import-role-chip">
              <strong>{role.name}</strong>
              <span>{role.slug}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="import-card">
        <h2 className="import-card__title">File format</h2>
        <p className="import-card__desc">
          CSV is recommended. JSON accepts an array or{" "}
          <code>{'{ "users": [...] }'}</code>.
        </p>
        <div className="import-formats import-formats--two">
          {(
            [
              { id: "csv" as const, label: "CSV", hint: "Comma-separated", icon: FileType },
              {
                id: "json" as const,
                label: "JSON",
                hint: "Structured list",
                icon: FileJson,
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
          <label className="import-option">
            <span className="import-option__label">Default password</span>
            <input
              className="ui-input"
              type="password"
              placeholder="Used when a row has no password"
              value={defaultPassword}
              onChange={(event) => setDefaultPassword(event.target.value)}
            />
            <span className="import-option__hint">
              Minimum 6 characters if rows omit passwords.
            </span>
          </label>
          <label className="import-option import-option--checkbox">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(event) => setUpdateExisting(event.target.checked)}
            />
            <span>Update existing users when email matches</span>
          </label>
        </div>
      </section>

      <section className="import-card">
        <h2 className="import-card__title">Upload file</h2>
        <p className="import-card__desc">
          Drag and drop or browse for a {format.toUpperCase()} file.
        </p>
        <input
          ref={inputRef}
          type="file"
          className="import-file-input"
          accept={acceptByFormat[format]}
          onChange={handleInputChange}
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
          onDrop={handleDrop}
        >
          <Upload size={28} aria-hidden />
          <p className="import-dropzone__title">
            {fileName ? fileName : "Drop your user file here"}
          </p>
          <p className="import-dropzone__hint">
            Columns: name, email, password, role
          </p>
          <button
            type="button"
            className="ui-btn ui-btn--secondary ui-btn--sm"
            onClick={handleBrowse}
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

      <section className="import-card">
        <div className="import-card__head">
          <div>
            <h2 className="import-card__title">Review preview</h2>
            <p className="import-card__desc">
              {rows.length > 0
                ? `${validRows.length} ready · ${invalidCount} with issues`
                : "Upload a file to validate rows before import."}
            </p>
          </div>
        </div>

        <div className="import-preview import-preview--users ui-scrollbar">
          <div className="import-preview__row import-preview__row--head import-preview__row--users">
            <span>#</span>
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
          </div>
          {rows.length === 0 ? (
            <div className="import-preview__empty">
              No rows loaded yet. Use the template to get started.
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={`${row.rowNumber}-${row.email}`}
                className={cn(
                  "import-preview__row import-preview__row--users",
                  row.errors.length > 0 && "import-preview__row--invalid"
                )}
              >
                <span>{row.rowNumber}</span>
                <span>{row.name || "—"}</span>
                <span>{row.email || "—"}</span>
                <span>{row.role || "—"}</span>
                <span className="import-preview__status">
                  {row.errors.length === 0 ? (
                    <>
                      <CheckCircle2 size={14} aria-hidden />
                      Ready
                    </>
                  ) : (
                    row.errors.join(" ")
                  )}
                </span>
              </div>
            ))
          )}
        </div>

        {result ? (
          <div className="import-result">
            <p>
              <strong>{result.created}</strong> created ·{" "}
              <strong>{result.updated}</strong> updated ·{" "}
              <strong>{result.skipped}</strong> skipped
            </p>
            {result.errors.length > 0 ? (
              <ul className="import-result__errors">
                {result.errors.slice(0, 8).map((item) => (
                  <li key={`${item.row}-${item.email}`}>
                    Row {item.row} ({item.email}): {item.message}
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
            disabled={validRows.length === 0 || isImporting}
            onClick={handleImport}
          >
            {isImporting
              ? "Importing…"
              : `Import ${validRows.length} user${validRows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </section>
    </div>
  );
}
