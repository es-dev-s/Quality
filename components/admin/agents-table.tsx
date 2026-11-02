"use client";
import { agentsTableQuerySchema } from "@/lib/admin/table-query";
import { remotePagination,usePageState,useServerResource } from "@/lib/hooks/use-server-resource";
import { pageInfo,type PageInfo } from "@/lib/server/page-query";

import { useDashboardShell } from "@/components/dashboard/shell";
import { Button } from "@/components/primitives/button";
import {
	DataTablePanel
} from "@/components/primitives/data-table-panel";
import type { AgentListItem } from "@/lib/actions/agents";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo,useState } from "react";

type AgentsTableProps = {
  agents: AgentListItem[];
  initialPagination?: PageInfo;
  initialTotal?: number;
  canManage: boolean;
  canManageUsers?: boolean;
  canTransferAgents?: boolean;
  onOpenUsersTab?: () => void;
  onOpenTeamTab?: () => void;
  embedded?: boolean;
};

export function AgentsTable({
  agents: initialAgents,
  initialPagination,
  initialTotal,
  canManage,
  canManageUsers = false,
  canTransferAgents = false,
  onOpenUsersTab,
  onOpenTeamTab,
  embedded = false,
}: AgentsTableProps) {
  const { user } = useDashboardShell();
  const isQualityAnalyst = user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST;
  const [search, setSearch] = useState("");

  const pageState = usePageState(search);
  const initialData = useMemo(() => ({ agents: initialAgents, pagination: initialPagination ?? pageInfo(initialAgents.length, { page: 1, pageSize: 20 }), totalCount: initialTotal ?? initialAgents.length, canManage }), [initialAgents, initialPagination, initialTotal, canManage]);
  const resource = useServerResource("agents", { page: pageState.page, pageSize: pageState.pageSize, search }, initialData, agentsTableQuerySchema.parse({}));
  const agents = resource.data.agents;
  const pagination = remotePagination(agents, resource.data.pagination, pageState);
  const manageAgentsAction = (
    <>
      {canTransferAgents ? (
        <Link
          href="/audit-transfer-history"
          className="ui-btn ui-btn--secondary ui-btn--sm"
        >
          Transfer history
        </Link>
      ) : null}
      {canManageUsers && onOpenUsersTab ? (
        <Button size="sm" onClick={onOpenUsersTab}>
          <UserPlus size={16} />
          Manage in Users
        </Button>
      ) : !canManageUsers && onOpenTeamTab && !isQualityAnalyst ? (
        <Button size="sm" onClick={onOpenTeamTab}>
          <UserPlus size={16} />
          Request agent
        </Button>
      ) : canManageUsers && !onOpenUsersTab ? (
        <Link href="/settings?tab=users" className="ui-btn ui-btn--primary ui-btn--sm">
          <UserPlus size={16} />
          Manage in Users
        </Link>
      ) : null}
    </>
  );

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
          </div>
        </div>
      )}

      <div className={embedded ? "settings-tab-layout__body" : undefined}>
        <div className={embedded ? "loading-zone--fill" : undefined}>
          {resource.error ? <p role="alert">{resource.error}</p> : null}
          <DataTablePanel
            pagination={pagination}
            paginationPending={resource.loading}
            fillViewport={embedded}
            summaryLabel={`${resource.data.pagination.total} of ${resource.data.totalCount} agent${
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
                    <th>User name</th>
                    <th>Email</th>
                    <th>Team</th>
                    <th>Date of joining</th>
                    <th>Audits</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((agent) => (
                    <tr key={agent.id}>
                      <td style={{ fontWeight: 500 }}>
                        <span>{agent.name}</span>
                        {agent.pendingTransfer ? (
                          <span
                            className="platform-tag platform-tag--warning"
                            style={{ marginLeft: 8 }}
                          >
                            Pending transfer
                          </span>
                        ) : null}
                      </td>
                      <td>{agent.email}</td>
                      <td>{agent.teamName ?? "—"}</td>
                      <td>{agent.dateOfJoining ?? "—"}</td>
                      <td>{agent.auditCount}</td>
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
