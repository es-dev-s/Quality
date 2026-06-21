"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";
import {
  FilterSidebar,
  FilterSidebarSection,
} from "@/components/filters/filter-sidebar";
import { FilterSelect } from "@/components/filters/filter-select";
import { useFilterSidebar } from "@/lib/hooks/use-filter-sidebar";
import type {
  ConnectedPerson,
  ConnectedUserRow,
  CreatedUsersByRole,
} from "@/lib/actions/user-connections";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

type ConnectedUsersPanelProps = {
  rows: ConnectedUserRow[];
  embedded?: boolean;
};

type RoleFilterOption = {
  slug: string;
  name: string;
};

function formatPeopleList(people: ConnectedPerson[], max = 2) {
  if (people.length === 0) return "—";
  const head = people
    .slice(0, max)
    .map((person) => person.name)
    .join(", ");
  if (people.length <= max) return head;
  return `${head} +${people.length - max} more`;
}

function formatTeamSummary(groups: CreatedUsersByRole[]) {
  if (groups.length === 0) return "—";
  return groups
    .map((group) => `${group.count} ${group.roleName}`)
    .join(", ");
}

function userStatusBadge(row: ConnectedUserRow) {
  if (!row.isActive) {
    return <Badge variant="error">Inactive</Badge>;
  }
  if (row.approvalStatus !== "ACTIVE") {
    return <Badge variant="warning">Pending</Badge>;
  }
  return <Badge variant="success">Active</Badge>;
}

function ConnectionDetailList({
  title,
  people,
}: {
  title: string;
  people: ConnectedPerson[];
}) {
  if (people.length === 0) return null;

  return (
    <div className="connected-users__detail-block">
      <h4 className="connected-users__detail-title">{title}</h4>
      <ul className="connected-users__detail-list">
        {people.map((person) => (
          <li key={person.id}>
            <span className="connected-users__detail-name">{person.name}</span>
            <span className="connected-users__detail-meta">
              {person.roleName} · {person.email}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExpandedConnectionRow({ row }: { row: ConnectedUserRow }) {
  return (
    <tr className="connected-users__expand-row">
      <td colSpan={7}>
        <div className="connected-users__expand-panel">
          <div className="connected-users__expand-grid">
            <ConnectionDetailList
              title={`Active agents (${row.assignedAgents.length})`}
              people={row.assignedAgents}
            />
            <ConnectionDetailList
              title={`Quality analyst (${row.assignedTo.length})`}
              people={row.assignedTo}
            />
            {row.createdBy ? (
              <div className="connected-users__detail-block">
                <h4 className="connected-users__detail-title">Created by</h4>
                <p className="connected-users__detail-single">
                  {row.createdBy.name}
                  <span className="connected-users__detail-meta">
                    {row.createdBy.roleName} · {row.createdBy.email}
                  </span>
                </p>
              </div>
            ) : null}
            {row.createdUsersTotal > 0 ? (
              <div className="connected-users__detail-block">
                <h4 className="connected-users__detail-title">
                  Team created ({row.createdUsersTotal})
                </h4>
                <ul className="connected-users__detail-list connected-users__detail-list--inline">
                  {row.createdUsers.map((group) => (
                    <li key={group.roleSlug}>
                      <span className="connected-users__detail-name">
                        {group.count} {group.roleName}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </td>
    </tr>
  );
}

export function ConnectedUsersPanel({
  rows,
  embedded = false,
}: ConnectedUsersPanelProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">(
    ""
  );
  const [connectionFilter, setConnectionFilter] = useState<
    "" | "has-agents" | "has-team" | "unlinked-agent"
  >("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filterSidebar = useFilterSidebar();

  const roleOptions = useMemo(() => {
    const map = new Map<string, RoleFilterOption>();
    for (const row of rows) {
      map.set(row.roleSlug, { slug: row.roleSlug, name: row.roleName });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const summary = useMemo(() => {
    const withAgents = rows.filter((row) => row.assignedAgents.length > 0).length;
    const withTeam = rows.filter((row) => row.createdUsersTotal > 0).length;
    const unlinkedAgents = rows.filter(
      (row) =>
        row.roleSlug === SYSTEM_ROLE_SLUGS.AGENT &&
        row.assignedTo.length === 0 &&
        row.isActive
    ).length;

    return { withAgents, withTeam, unlinkedAgents };
  }, [rows]);

  const activeSidebarFilterCount =
    (roleFilter ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (connectionFilter ? 1 : 0);

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (roleFilter) {
      const role = roleOptions.find((entry) => entry.slug === roleFilter);
      chips.push({
        key: "role",
        label: `Role: ${role?.name ?? roleFilter}`,
        onRemove: () => setRoleFilter(""),
      });
    }
    if (statusFilter) {
      chips.push({
        key: "status",
        label: `Status: ${statusFilter === "active" ? "Active" : "Inactive"}`,
        onRemove: () => setStatusFilter(""),
      });
    }
    if (connectionFilter) {
      const labels: Record<string, string> = {
        "has-agents": "Has connected agents",
        "has-team": "Has team members",
        "unlinked-agent": "Unlinked agents",
      };
      chips.push({
        key: "connection",
        label: labels[connectionFilter] ?? connectionFilter,
        onRemove: () => setConnectionFilter(""),
      });
    }
    return chips;
  }, [roleFilter, statusFilter, connectionFilter, roleOptions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (roleFilter && row.roleSlug !== roleFilter) return false;
      if (statusFilter === "active" && !row.isActive) return false;
      if (statusFilter === "inactive" && row.isActive) return false;
      if (connectionFilter === "has-agents" && row.assignedAgents.length === 0) {
        return false;
      }
      if (connectionFilter === "has-team" && row.createdUsersTotal === 0) {
        return false;
      }
      if (
        connectionFilter === "unlinked-agent" &&
        !(
          row.roleSlug === SYSTEM_ROLE_SLUGS.AGENT &&
          row.assignedTo.length === 0 &&
          row.isActive
        )
      ) {
        return false;
      }
      if (!q) return true;

      const haystack = [
        row.name,
        row.email,
        row.roleName,
        row.createdBy?.name ?? "",
        ...row.assignedAgents.map((person) => person.name),
        ...row.assignedTo.map((person) => person.name),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, search, roleFilter, statusFilter, connectionFilter]);

  const pagination = usePaginatedRows(filtered);

  const sidebar = (
    <FilterSidebar
      open={filterSidebar.open}
      onOpenChange={filterSidebar.onOpenChange}
      title="Connection filters"
      description="Narrow by role, status, or relationship type."
      activeCount={activeSidebarFilterCount}
      onClearAll={() => {
        setRoleFilter("");
        setStatusFilter("");
        setConnectionFilter("");
      }}
      clearDisabled={activeSidebarFilterCount === 0}
    >
      <FilterSidebarSection label="Role">
        <FilterSelect
          value={roleFilter}
          options={[
            { value: "", label: "All roles" },
            ...roleOptions.map((role) => ({
              value: role.slug,
              label: role.name,
            })),
          ]}
          onChange={setRoleFilter}
          ariaLabel="Filter by role"
        />
      </FilterSidebarSection>
      <FilterSidebarSection label="Status">
        <FilterSelect
          value={statusFilter}
          options={[
            { value: "", label: "All status" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          onChange={(value) =>
            setStatusFilter(value as "" | "active" | "inactive")
          }
          ariaLabel="Filter by status"
        />
      </FilterSidebarSection>
      <FilterSidebarSection label="Connections">
        <FilterSelect
          value={connectionFilter}
          options={[
            { value: "", label: "Any connection" },
            { value: "has-agents", label: "Has connected agents" },
            { value: "has-team", label: "Has team members" },
            { value: "unlinked-agent", label: "Unlinked agents" },
          ]}
          onChange={(value) =>
            setConnectionFilter(
              value as "" | "has-agents" | "has-team" | "unlinked-agent"
            )
          }
          ariaLabel="Filter by connection type"
        />
      </FilterSidebarSection>
    </FilterSidebar>
  );

  return (
    <div
      className={
        embedded ? "settings-tab-layout connected-users" : "connected-users"
      }
    >
      {!embedded && (
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-head__title">Connected users</h2>
            <p className="admin-section-head__desc">
              Active agent rosters and QA assignments — aligned with dashboard and audit forms.
            </p>
          </div>
        </div>
      )}

      <div className={embedded ? "settings-tab-layout__body" : undefined}>
        <div className="connected-users__summary" aria-label="Connection overview">
          <div className="connected-users__stat">
            <span className="connected-users__stat-value">{rows.length}</span>
            <span className="connected-users__stat-label">Users in view</span>
          </div>
          <div className="connected-users__stat">
            <span className="connected-users__stat-value">{summary.withAgents}</span>
            <span className="connected-users__stat-label">With active agents</span>
          </div>
          <div className="connected-users__stat">
            <span className="connected-users__stat-value">{summary.withTeam}</span>
            <span className="connected-users__stat-label">With team members</span>
          </div>
          <div className="connected-users__stat">
            <span className="connected-users__stat-value">
              {summary.unlinkedAgents}
            </span>
            <span className="connected-users__stat-label">Unassigned agents</span>
          </div>
        </div>
        <p className="settings-tab-layout__footnote connected-users__footnote">
          Supervisors: agents they provisioned. Quality analysts: QM-assigned plus
          provisioned agents. Agents: assigned quality analyst shown under Assigned to.
        </p>

        <div className={embedded ? "loading-zone--fill" : undefined}>
          <DataTablePanel
            pagination={pagination}
            fillViewport={embedded}
            summaryLabel={`${filtered.length} of ${rows.length} user${
              rows.length === 1 ? "" : "s"
            }`}
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search users, roles, or connections…",
              ariaLabel: "Search connected users",
            }}
            filterControl={{
              activeCount: activeSidebarFilterCount,
              onOpen: filterSidebar.openFilters,
            }}
            filterChips={filterChips}
            onClearFilters={() => {
              setRoleFilter("");
              setStatusFilter("");
              setConnectionFilter("");
            }}
            emptyState={
              rows.length === 0 ? (
                <p>No users are visible in your connection scope yet.</p>
              ) : (
                <p>No users match your search or filters.</p>
              )
            }
            renderTable={(slice) => (
              <table className="ui-table platform-report-table settings-table connected-users__table">
                <colgroup>
                  <col className="connected-users__col-expand" />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th aria-label="Expand row" />
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Active agents</th>
                    <th>Assigned to (QA)</th>
                    <th>Team created</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((row) => {
                    const isExpanded = expandedId === row.id;
                    const hasDetails =
                      row.assignedAgents.length > 0 ||
                      row.assignedTo.length > 0 ||
                      row.createdBy !== null ||
                      row.createdUsersTotal > 0;

                    return (
                      <Fragment key={row.id}>
                        <tr
                          className={
                            isExpanded
                              ? "settings-table__row connected-users__row connected-users__row--expanded"
                              : "settings-table__row connected-users__row"
                          }
                        >
                          <td className="connected-users__expand-cell">
                            {hasDetails ? (
                              <button
                                type="button"
                                className="connected-users__expand-btn"
                                aria-expanded={isExpanded}
                                aria-label={
                                  isExpanded
                                    ? `Collapse details for ${row.name}`
                                    : `Expand details for ${row.name}`
                                }
                                onClick={() =>
                                  setExpandedId(isExpanded ? null : row.id)
                                }
                              >
                                {isExpanded ? (
                                  <ChevronDown size={16} aria-hidden />
                                ) : (
                                  <ChevronRight size={16} aria-hidden />
                                )}
                              </button>
                            ) : null}
                          </td>
                          <td>
                            <span className="connected-users__cell-primary">
                              {row.name}
                            </span>
                            <span className="connected-users__cell-secondary">
                              {row.email}
                            </span>
                            {row.createdBy ? (
                              <span className="connected-users__cell-hint">
                                Created by {row.createdBy.name}
                              </span>
                            ) : null}
                          </td>
                          <td>{row.roleName}</td>
                          <td>{userStatusBadge(row)}</td>
                          <td>
                            {row.assignedAgents.length > 0 ? (
                              <>
                                <span className="connected-users__count">
                                  {row.assignedAgents.length}
                                </span>{" "}
                                {formatPeopleList(row.assignedAgents)}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{formatPeopleList(row.assignedTo)}</td>
                          <td>{formatTeamSummary(row.createdUsers)}</td>
                        </tr>
                        {isExpanded ? <ExpandedConnectionRow row={row} /> : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          />
        </div>
      </div>

      {sidebar}
    </div>
  );
}
