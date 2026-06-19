"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/field";
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

      <div className={embedded ? "settings-tab-layout__head" : undefined}>
        <div className="section-toolbar">
        <span className="section-toolbar__meta">
          {filtered.length} agent{filtered.length === 1 ? "" : "s"}
        </span>
        <div className="section-toolbar__search">
          <Search size={16} className="section-toolbar__search-icon" aria-hidden />
          <Input
            type="search"
            className="ui-input"
            placeholder="Search agent users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search agent users"
          />
        </div>
        <div className="section-toolbar__actions">
          {canManageUsers && onOpenUsersTab && (
            <Button onClick={onOpenUsersTab}>
              <UserPlus size={16} />
              Manage in Users
            </Button>
          )}
          {!canManageUsers && onOpenTeamTab && (
            <Button onClick={onOpenTeamTab}>
              <UserPlus size={16} />
              Request agent
            </Button>
          )}
          {canManageUsers && !onOpenUsersTab && (
            <Link
              href="/settings?tab=users"
              className="ui-btn ui-btn--primary ui-btn--md"
            >
              <UserPlus size={16} />
              Manage in Users
            </Link>
          )}
        </div>
        </div>
      </div>

      <div className={embedded ? "settings-tab-layout__body" : undefined}>
        <DataTablePanel
          pagination={pagination}
          fillViewport={embedded}
          renderTable={(slice) => (
          <table className="ui-table platform-report-table">
            <thead>
              <tr>
                <th>Display name</th>
                <th>Email</th>
                <th>Date of joining</th>
                <th>Audits</th>
                <th>Profile</th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ui-table__empty">
                    {agents.length === 0
                      ? canManageUsers
                        ? "No agent users yet. Create a user and assign the Agent role in the Users tab."
                        : "No users are assigned the Agent role yet."
                      : "No agent users match your search."}
                  </td>
                </tr>
              ) : (
                slice.map((agent) => (
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
                ))
              )}
            </tbody>
          </table>
        )}
      />

        {canManage && (
          <p className="ui-hint" style={{ marginTop: 12 }}>
            To add or remove agents, use the Users tab and assign the Agent system
            role. Pre-named agent lists are no longer used.
          </p>
        )}
      </div>
    </div>
  );
}
