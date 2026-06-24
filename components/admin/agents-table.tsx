"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";
import type { AgentListItem } from "@/lib/actions/agents";

type AgentsTableProps = {
  agents: AgentListItem[];
  canManage: boolean;
  canManageUsers?: boolean;
  onOpenUsersTab?: () => void;
  onOpenTeamTab?: () => void;
  embedded?: boolean;
};

export function AgentsTable({
  agents,
  canManage,
  canManageUsers = false,
  onOpenUsersTab,
  onOpenTeamTab,
  embedded = false,
}: AgentsTableProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(q) ||
        agent.email.toLowerCase().includes(q)
    );
  }, [agents, search]);

  const pagination = usePaginatedRows(filtered);

  const manageAgentsAction =
    canManageUsers && onOpenUsersTab ? (
      <Button size="sm" onClick={onOpenUsersTab}>
        <UserPlus size={16} />
        Manage in Users
      </Button>
    ) : !canManageUsers && onOpenTeamTab ? (
      <Button size="sm" onClick={onOpenTeamTab}>
        <UserPlus size={16} />
        Request agent
      </Button>
    ) : canManageUsers && !onOpenUsersTab ? (
      <Link href="/settings?tab=users" className="ui-btn ui-btn--primary ui-btn--sm">
        <UserPlus size={16} />
        Manage in Users
      </Link>
    ) : null;

  const emptyState =
    agents.length === 0 ? (
      <p>
        {canManageUsers
          ? "No agent users yet. Create a user and assign the Agent role in the Users tab."
          : "No users are assigned the Agent role yet."}
      </p>
    ) : (
      <p>No agent users match your search.</p>
    );

  return (
    <div className={embedded ? "settings-tab-layout" : undefined}>
      {!embedded && (
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-head__title">Agent users</h2>
            <p className="admin-section-head__desc">
              Users with the Agent role appear in audit forms and row-level data
              filters.
            </p>
          </div>
        </div>
      )}

      <div className={embedded ? "settings-tab-layout__body" : undefined}>
        <div className={embedded ? "loading-zone--fill" : undefined}>
          <DataTablePanel
            pagination={pagination}
            fillViewport={embedded}
            summaryLabel={`${filtered.length} of ${agents.length} agent${
              agents.length === 1 ? "" : "s"
            }`}
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search agent users…",
              ariaLabel: "Search agent users",
            }}
            headerActions={manageAgentsAction}
            emptyState={emptyState}
            renderTable={(slice) => (
              <table className="ui-table platform-report-table">
                <thead>
                  <tr>
                    <th>Profile name</th>
                    <th>Email</th>
                    <th>Date of joining</th>
                    <th>Audits</th>
                    <th>Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((agent) => (
                    <tr key={agent.id}>
                      <td style={{ fontWeight: 500 }}>{agent.name}</td>
                      <td>{agent.email}</td>
                      <td>{agent.dateOfJoining ?? "—"}</td>
                      <td>{agent.auditCount}</td>
                      <td>
                        {agent.hasProfileName ? (
                          <Badge tone="accent">Named</Badge>
                        ) : (
                          <Badge tone="neutral">Uses email</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />

          {canManage && (
            <p className="ui-hint settings-tab-layout__footnote">
              To add or remove agents, use the Users tab and assign the Agent system
              role.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
