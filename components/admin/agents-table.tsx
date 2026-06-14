"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import type { AgentListItem } from "@/lib/actions/agents";

type AgentsTableProps = {
  agents: AgentListItem[];
  canManage: boolean;
  canManageUsers?: boolean;
  onOpenUsersTab?: () => void;
  embedded?: boolean;
};

export function AgentsTable({
  agents,
  canManage,
  canManageUsers = false,
  onOpenUsersTab,
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

  return (
    <>
      <div className="admin-section-head">
        {!embedded && (
          <div>
            <h2 className="admin-section-head__title">Agent users</h2>
            <p className="admin-section-head__desc">
              Users with the Agent role appear in audit forms and row-level data
              filters.
            </p>
          </div>
        )}
        {embedded && (
          <p className="admin-section-head__desc">
            Users assigned the <strong>Agent</strong> system role. Their display
            name is used on audit forms and must match audit records for scoped
            access.
          </p>
        )}
        {canManageUsers && onOpenUsersTab && (
          <Button onClick={onOpenUsersTab}>
            <UserPlus size={16} />
            Manage in Users
          </Button>
        )}
        {canManageUsers && !onOpenUsersTab && (
          <Link href="/settings?tab=users" className="ui-btn ui-btn--primary ui-btn--md">
            <UserPlus size={16} />
            Manage in Users
          </Link>
        )}
      </div>

      <div className="platform-settings__toolbar">
        <div className="platform-settings__search-wrap">
          <Search
            size={16}
            className="platform-settings__search-icon"
            aria-hidden
          />
          <input
            type="search"
            className="platform-settings__search"
            placeholder="Search agent users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="ui-table-wrap">
        <table className="ui-table">
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
            {filtered.length === 0 ? (
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
              filtered.map((agent) => (
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
      </div>

      {canManage && (
        <p className="ui-hint" style={{ marginTop: 12 }}>
          To add or remove agents, use the Users tab and assign the Agent system
          role. Pre-named agent lists are no longer used.
        </p>
      )}
    </>
  );
}
