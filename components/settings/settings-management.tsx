"use client";
import type { PageInfo } from "@/lib/server/page-query";

import { AgentsTable } from "@/components/admin/agents-table";
import { ConnectedUsersPanel } from "@/components/admin/connected-users-panel";
import { InteractionConfigManager } from "@/components/admin/interaction-config-manager";
import { RolesTable } from "@/components/admin/roles-table";
import { TeamManagement } from "@/components/admin/team-management";
import { UsersTable } from "@/components/admin/users-table";
import { useToast } from "@/components/primitives/toast";
import type { AgentListItem } from "@/lib/actions/agents";
import type { ConnectedUserRow } from "@/lib/actions/user-connections";
import type { getTeamManagementData } from "@/lib/actions/user-provisioning";
import type { InteractionConfig } from "@/lib/audit/types";
import { useRouter } from "next/navigation";
import { useEffect,useState,useTransition } from "react";



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

  teamName?: string | null;

  isActive?: boolean;

  createdAt: string;

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

  canRevealPasswords?: boolean;

  canManageRoles: boolean;

  canAccessTeam: boolean;

  teamData: TeamData | null;

  users: User[];
  usersPagination?: PageInfo;
  usersTotal?: number;

  roles: Role[];

  agents: AgentListItem[];
  agentsPagination?: PageInfo;
  agentsTotal?: number;

  canManageAgents: boolean;

  canTransferAgents?: boolean;

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

  canRevealPasswords = false,

  canManageRoles,

  canAccessTeam,

  teamData,

  users,
  usersPagination,
  usersTotal,

  roles,

  agents,
  agentsPagination,
  agentsTotal,

  canManageAgents,

  canTransferAgents = false,

  interactionConfig,

  interactionUpdatedAt,

  interactionConfigVersion,

  canManageInteraction,

  canViewConnections,

  connectedUsers,

}: SettingsManagementProps) {

  const router = useRouter();
  const { dismissPasswordToasts } = useToast();
  const [tabPending, startTabTransition] = useTransition();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [lastInitialTab, setLastInitialTab] = useState(initialTab);
  if (lastInitialTab !== initialTab) { setLastInitialTab(initialTab); setTab(initialTab); }

  const [interactionMounted, setInteractionMounted] = useState(
    initialTab === "interaction" && canManageInteraction
  );

  function goToTab(next: TabId) {
    if (next === tab && !tabPending) return;
    setTab(next);
    startTabTransition(() => {
      const href =
        next === "agents" ? "/settings" : `/settings?tab=${next}`;
      router.push(href);
    });
  }

  const allowed = tab === "agents" || (tab === "interaction" && canManageInteraction) || (tab === "team" && canAccessTeam) || (tab === "connected" && canViewConnections) || (tab === "users" && (canManageUsers || canRevealPasswords)) || (tab === "roles" && canManageRoles);
  if (!allowed) setTab("agents");
  if (tab === "interaction" && canManageInteraction && !interactionMounted) setInteractionMounted(true);

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

          onClick={() => goToTab("agents")}

        >

          Agent users
          {tab === "agents" ? (
            <span className="segmented-tabs__count">{agents.length}</span>
          ) : null}

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

            onClick={() => goToTab("interaction")}

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

            onClick={() => goToTab("team")}

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

            onClick={() => goToTab("connected")}

          >

            Connected
            {tab === "connected" ? (
              <span className="segmented-tabs__count">{connectedUsers.length}</span>
            ) : null}

          </button>

        )}

        {(canManageUsers || canRevealPasswords) && (

          <button

            type="button"

            role="tab"

            aria-selected={tab === "users"}

            className={

              tab === "users"

                ? "segmented-tabs__btn segmented-tabs__btn--active"

                : "segmented-tabs__btn"

            }

            onClick={() => goToTab("users")}

          >

            Users
            {tab === "users" ? (
              <span className="segmented-tabs__count">{users.length}</span>
            ) : null}

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

            onClick={() => goToTab("roles")}

          >

            Roles
            {tab === "roles" ? (
              <span className="segmented-tabs__count">{roles.length}</span>
            ) : null}

          </button>

        )}

      </div>



      <div className={"settings-page__body" + (tabPending ? " settings-page__body--pending" : "")}>

        <div

          role="tabpanel"

          className="settings-page__panel"

          hidden={tab !== "agents"}

        >

          {tab === "agents" && (

            <AgentsTable
              initialPagination={agentsPagination}
              initialTotal={agentsTotal}

              agents={agents}

              canManage={canManageAgents}

              canManageUsers={canManageUsers}

              canTransferAgents={canTransferAgents}

              onOpenUsersTab={(canManageUsers || canRevealPasswords) ? () => goToTab("users") : undefined}

              onOpenTeamTab={canAccessTeam ? () => goToTab("team") : undefined}

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



        {(canManageUsers || canRevealPasswords) && (

          <div

            role="tabpanel"

            className="settings-page__panel"

            hidden={tab !== "users"}

          >

            {tab === "users" && (

              <UsersTable users={users} initialPagination={usersPagination} initialTotal={usersTotal} roles={roleOptions} embedded passwordAccessOnly={!canManageUsers} />

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


