"use client";

import { useEffect, useState } from "react";
import { AgentsTable } from "@/components/admin/agents-table";
import { InteractionConfigManager } from "@/components/admin/interaction-config-manager";
import { UsersTable } from "@/components/admin/users-table";
import { RolesTable } from "@/components/admin/roles-table";
import type { AgentListItem } from "@/lib/actions/agents";
import type { InteractionConfig } from "@/lib/audit/types";

type RoleOption = {
  id: string;
  name: string;
  slug: string;
  isSystem?: boolean;
  _count?: { scopes: number };
};

type User = {
  id: string;
  name: string | null;
  email: string;
  roleId: string;
  role: RoleOption;
  dateOfJoining?: string | null;
  createdAt: Date;
};

type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  _count: { users: number; scopes: number };
};

type TabId = "agents" | "interaction" | "users" | "roles";

type SettingsManagementProps = {
  initialTab?: TabId;
  canManageUsers: boolean;
  canManageRoles: boolean;
  users: User[];
  roles: Role[];
  agents: AgentListItem[];
  canManageAgents: boolean;
  interactionConfig: InteractionConfig;
  interactionUpdatedAt: string;
  interactionConfigVersion: number;
  canManageInteraction: boolean;
};

export function SettingsManagement({
  initialTab = "agents",
  canManageUsers,
  canManageRoles,
  users,
  roles,
  agents,
  canManageAgents,
  interactionConfig,
  interactionUpdatedAt,
  interactionConfigVersion,
  canManageInteraction,
}: SettingsManagementProps) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [interactionMounted, setInteractionMounted] = useState(
    initialTab === "interaction"
  );

  useEffect(() => {
    setTab(initialTab);
    if (initialTab === "interaction") {
      setInteractionMounted(true);
    }
  }, [initialTab]);

  useEffect(() => {
    if (tab === "interaction") {
      setInteractionMounted(true);
    }
  }, [tab]);

  const roleOptions: RoleOption[] = roles.map(
    ({ id, name, slug, isSystem, _count }) => ({
      id,
      name,
      slug,
      isSystem,
      _count,
    })
  );

  return (
    <div>
      <div className="access-tabs" role="tablist" aria-label="Settings">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "agents"}
          className={
            tab === "agents"
              ? "access-tabs__btn access-tabs__btn--active"
              : "access-tabs__btn"
          }
          onClick={() => setTab("agents")}
        >
          Agent users
          <span className="access-tabs__count">{agents.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "interaction"}
          className={
            tab === "interaction"
              ? "access-tabs__btn access-tabs__btn--active"
              : "access-tabs__btn"
          }
          onClick={() => setTab("interaction")}
        >
          Interaction
        </button>
        {canManageUsers && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "users"}
            className={
              tab === "users"
                ? "access-tabs__btn access-tabs__btn--active"
                : "access-tabs__btn"
            }
            onClick={() => setTab("users")}
          >
            Users
            <span className="access-tabs__count">{users.length}</span>
          </button>
        )}
        {canManageRoles && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "roles"}
            className={
              tab === "roles"
                ? "access-tabs__btn access-tabs__btn--active"
                : "access-tabs__btn"
            }
            onClick={() => setTab("roles")}
          >
            Roles
            <span className="access-tabs__count">{roles.length}</span>
          </button>
        )}
      </div>

      <div role="tabpanel" hidden={tab !== "agents"}>
        {tab === "agents" && (
          <AgentsTable
            agents={agents}
            canManage={canManageAgents}
            canManageUsers={canManageUsers}
            onOpenUsersTab={canManageUsers ? () => setTab("users") : undefined}
            embedded
          />
        )}
      </div>

      <div role="tabpanel" hidden={tab !== "interaction"}>
        {interactionMounted && (
          <InteractionConfigManager
            initialConfig={interactionConfig}
            canManage={canManageInteraction}
            updatedAt={interactionUpdatedAt}
            configVersion={interactionConfigVersion}
          />
        )}
      </div>

      {canManageUsers && (
        <div role="tabpanel" hidden={tab !== "users"}>
          {tab === "users" && (
            <UsersTable users={users} roles={roleOptions} embedded />
          )}
        </div>
      )}
      {canManageRoles && (
        <div role="tabpanel" hidden={tab !== "roles"}>
          {tab === "roles" && <RolesTable roles={roles} embedded />}
        </div>
      )}
    </div>
  );
}
