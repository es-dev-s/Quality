"use client";



import { useEffect, useState } from "react";

import { AgentsTable } from "@/components/admin/agents-table";

import { InteractionConfigManager } from "@/components/admin/interaction-config-manager";

import { ConnectedUsersPanel } from "@/components/admin/connected-users-panel";
import { TeamManagement } from "@/components/admin/team-management";

import { UsersTable } from "@/components/admin/users-table";

import { RolesTable } from "@/components/admin/roles-table";

import { useToast } from "@/components/primitives/toast";

import type { AgentListItem } from "@/lib/actions/agents";

import type { ConnectedUserRow } from "@/lib/actions/user-connections";
import type { getTeamManagementData } from "@/lib/actions/user-provisioning";

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



type TabId = "agents" | "interaction" | "users" | "roles" | "team" | "connected";



type TeamData = Awaited<ReturnType<typeof getTeamManagementData>>;



type SettingsManagementProps = {

  initialTab?: TabId;

  canManageUsers: boolean;

  canManageRoles: boolean;

  canAccessTeam: boolean;

  teamData: TeamData | null;

  users: User[];

  roles: Role[];

  agents: AgentListItem[];

  canManageAgents: boolean;

  interactionConfig: InteractionConfig | null;

  interactionUpdatedAt: string;

  interactionConfigVersion: number;

  canManageInteraction: boolean;

  canViewConnections: boolean;

  connectedUsers: ConnectedUserRow[];

};



export function SettingsManagement({

  initialTab = "agents",

  canManageUsers,

  canManageRoles,

  canAccessTeam,

  teamData,

  users,

  roles,

  agents,

  canManageAgents,

  interactionConfig,

  interactionUpdatedAt,

  interactionConfigVersion,

  canManageInteraction,

  canViewConnections,

  connectedUsers,

}: SettingsManagementProps) {

  const { dismissPasswordToasts } = useToast();
  const [tab, setTab] = useState<TabId>(initialTab);

  const [interactionMounted, setInteractionMounted] = useState(

    initialTab === "interaction" && canManageInteraction

  );



  useEffect(() => {
    const allowed =
      tab === "agents" ||
      (tab === "interaction" && canManageInteraction) ||
      (tab === "team" && canAccessTeam) ||
      (tab === "connected" && canViewConnections) ||
      (tab === "users" && canManageUsers) ||
      (tab === "roles" && canManageRoles);
    if (!allowed) {
      setTab("agents");
    }
  }, [
    tab,
    canManageInteraction,
    canAccessTeam,
    canViewConnections,
    canManageUsers,
    canManageRoles,
  ]);

  useEffect(() => {

    setTab(initialTab);

    if (initialTab === "interaction" && canManageInteraction) {

      setInteractionMounted(true);

    }

  }, [initialTab, canManageInteraction]);



  useEffect(() => {

    if (tab === "interaction" && canManageInteraction) {

      setInteractionMounted(true);

    }

  }, [tab, canManageInteraction]);



  useEffect(() => {
    dismissPasswordToasts();
  }, [tab, dismissPasswordToasts]);



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

    <div className="settings-page">

      <div className="settings-page__tabs segmented-tabs" role="tablist" aria-label="Settings">

        <button

          type="button"

          role="tab"

          aria-selected={tab === "agents"}

          className={

            tab === "agents"

              ? "segmented-tabs__btn segmented-tabs__btn--active"

              : "segmented-tabs__btn"

          }

          onClick={() => setTab("agents")}

        >

          Agent users

          <span className="segmented-tabs__count">{agents.length}</span>

        </button>

        {canManageInteraction && (

          <button

            type="button"

            role="tab"

            aria-selected={tab === "interaction"}

            className={

              tab === "interaction"

                ? "segmented-tabs__btn segmented-tabs__btn--active"

                : "segmented-tabs__btn"

            }

            onClick={() => setTab("interaction")}

          >

            Interaction

          </button>

        )}

        {canAccessTeam && (

          <button

            type="button"

            role="tab"

            aria-selected={tab === "team"}

            className={

              tab === "team"

                ? "segmented-tabs__btn segmented-tabs__btn--active"

                : "segmented-tabs__btn"

            }

            onClick={() => setTab("team")}

          >

            Team

            {teamData?.pendingApprovals.length ? (

              <span className="segmented-tabs__count">

                {teamData.pendingApprovals.length}

              </span>

            ) : null}

          </button>

        )}

        {canViewConnections && (

          <button

            type="button"

            role="tab"

            aria-selected={tab === "connected"}

            className={

              tab === "connected"

                ? "segmented-tabs__btn segmented-tabs__btn--active"

                : "segmented-tabs__btn"

            }

            onClick={() => setTab("connected")}

          >

            Connected

            <span className="segmented-tabs__count">{connectedUsers.length}</span>

          </button>

        )}

        {canManageUsers && (

          <button

            type="button"

            role="tab"

            aria-selected={tab === "users"}

            className={

              tab === "users"

                ? "segmented-tabs__btn segmented-tabs__btn--active"

                : "segmented-tabs__btn"

            }

            onClick={() => setTab("users")}

          >

            Users

            <span className="segmented-tabs__count">{users.length}</span>

          </button>

        )}

        {canManageRoles && (

          <button

            type="button"

            role="tab"

            aria-selected={tab === "roles"}

            className={

              tab === "roles"

                ? "segmented-tabs__btn segmented-tabs__btn--active"

                : "segmented-tabs__btn"

            }

            onClick={() => setTab("roles")}

          >

            Roles

            <span className="segmented-tabs__count">{roles.length}</span>

          </button>

        )}

      </div>



      <div className="settings-page__body">

        <div

          role="tabpanel"

          className="settings-page__panel"

          hidden={tab !== "agents"}

        >

          {tab === "agents" && (

            <AgentsTable

              agents={agents}

              canManage={canManageAgents}

              canManageUsers={canManageUsers}

              onOpenUsersTab={canManageUsers ? () => setTab("users") : undefined}

              onOpenTeamTab={canAccessTeam ? () => setTab("team") : undefined}

              embedded

            />

          )}

        </div>



        {canManageInteraction && interactionConfig && (

          <div

            role="tabpanel"

            className="settings-page__panel"

            hidden={tab !== "interaction"}

          >

            {interactionMounted && tab === "interaction" && (

              <InteractionConfigManager

                initialConfig={interactionConfig}

                canManage={canManageInteraction}

                updatedAt={interactionUpdatedAt}

                configVersion={interactionConfigVersion}

              />

            )}

          </div>

        )}



        {canAccessTeam && teamData && (

          <div

            role="tabpanel"

            className="settings-page__panel"

            hidden={tab !== "team"}

          >

            {tab === "team" && <TeamManagement {...teamData} embedded />}

          </div>

        )}



        {canViewConnections && (

          <div

            role="tabpanel"

            className="settings-page__panel"

            hidden={tab !== "connected"}

          >

            {tab === "connected" && (

              <ConnectedUsersPanel rows={connectedUsers} embedded />

            )}

          </div>

        )}



        {canManageUsers && (

          <div

            role="tabpanel"

            className="settings-page__panel"

            hidden={tab !== "users"}

          >

            {tab === "users" && (

              <UsersTable users={users} roles={roleOptions} embedded />

            )}

          </div>

        )}



        {canManageRoles && (

          <div

            role="tabpanel"

            className="settings-page__panel"

            hidden={tab !== "roles"}

          >

            {tab === "roles" && <RolesTable roles={roles} embedded />}

          </div>

        )}

      </div>

    </div>

  );

}


