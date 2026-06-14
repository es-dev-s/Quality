"use client";

import { cn } from "@/lib/utils";
import {
  ACCESS_MODULES,
  ACCESS_SCOPE_LABEL,
  DATA_VISIBILITY,
  getModuleAccessMatrix,
  SYSTEM_ROLE_ORDER,
  type ModuleAccessCell,
} from "@/lib/role-access-matrix";
import { SYSTEM_ROLE_DEFINITIONS } from "@/lib/permissions";
import type { SystemRoleSlug } from "@/lib/permissions";

function accessClass(cell: ModuleAccessCell) {
  if (cell === "—") return "role-matrix__cell--none";
  if (cell === "Read/Write") return "role-matrix__cell--write";
  if (cell === "Change status") return "role-matrix__cell--status";
  if (cell === "Partial") return "role-matrix__cell--partial";
  return "role-matrix__cell--read";
}

export function RoleAccessMatrix() {
  return (
    <div className="role-matrix">
      <div className="role-matrix__head">
        <h3 className="role-matrix__title">Roles &amp; module access</h3>
        <p className="role-matrix__desc">
          Predefined system roles. Row-level data visibility is enforced on audit
          records in addition to these module permissions.
        </p>
      </div>

      <div className="role-matrix__scroll">
        <table className="role-matrix__table">
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Data visible</th>
              <th scope="col">Access</th>
              {ACCESS_MODULES.map((module) => (
                <th key={module.key} scope="col">
                  {module.shortLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SYSTEM_ROLE_ORDER.map((slug) => {
              const definition = SYSTEM_ROLE_DEFINITIONS[slug];
              const matrix = getModuleAccessMatrix(slug);
              return (
                <tr key={slug}>
                  <th scope="row" className="role-matrix__role">
                    <span className="role-matrix__role-name">{definition.name}</span>
                    <span className="role-matrix__role-slug">{slug}</span>
                  </th>
                  <td className="role-matrix__data">{DATA_VISIBILITY[slug]}</td>
                  <td>{ACCESS_SCOPE_LABEL[slug]}</td>
                  {ACCESS_MODULES.map((module) => {
                    const cell = matrix[module.key];
                    return (
                      <td key={module.key}>
                        <span
                          className={cn("role-matrix__cell", accessClass(cell))}
                        >
                          {cell}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="role-matrix__legend">
        <li>
          <span className="role-matrix__cell role-matrix__cell--read">Read</span>
          View module
        </li>
        <li>
          <span className="role-matrix__cell role-matrix__cell--write">
            Read/Write
          </span>
          Full module control
        </li>
        <li>
          <span className="role-matrix__cell role-matrix__cell--status">
            Change status
          </span>
          Feedback status only
        </li>
        <li>
          <span className="role-matrix__cell role-matrix__cell--none">—</span>
          No access
        </li>
      </ul>
    </div>
  );
}

export function RoleAccessSummary({ slug }: { slug: SystemRoleSlug | string }) {
  if (!(slug in SYSTEM_ROLE_DEFINITIONS)) {
    return (
      <p className="role-matrix__custom-note">
        Custom role — assign scopes or use a system role template. Users with no
        scopes cannot access any module after sign-in.
      </p>
    );
  }

  const roleSlug = slug as SystemRoleSlug;
  const matrix = getModuleAccessMatrix(roleSlug);
  const modules = ACCESS_MODULES.filter((m) => matrix[m.key] !== "—");

  return (
    <div className="role-matrix__summary">
      <p className="role-matrix__summary-visibility">
        {DATA_VISIBILITY[roleSlug]}
      </p>
      <div className="role-matrix__summary-tags">
        {modules.map((module) => (
          <span
            key={module.key}
            className={cn(
              "role-matrix__cell",
              accessClass(matrix[module.key])
            )}
          >
            {module.label}: {matrix[module.key]}
          </span>
        ))}
      </div>
    </div>
  );
}
