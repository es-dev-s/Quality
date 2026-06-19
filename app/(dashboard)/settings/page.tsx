import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { SettingsPageSkeleton } from "@/components/dashboard/page-skeletons";
import { SettingsManagement } from "@/components/settings/settings-management";
import { getAgentsForManagement } from "@/lib/actions/agents";
import { getRoles, getUsers } from "@/lib/actions/admin";
import { getTeamManagementData } from "@/lib/actions/user-provisioning";
import { getInteractionConfigManagerData } from "@/lib/actions/interaction-config";
import { requirePageAccess } from "@/lib/auth-guards";
import {
  canAccessTeamManagement,
  canManageRoles,
  canManageSettings,
  canManageUsers,
} from "@/lib/rbac";

type SettingsTab = "agents" | "interaction" | "users" | "roles" | "team";

function resolveInitialTab(
  value: string | undefined,
  canManageInteraction: boolean,
  canAccessTeam: boolean
): SettingsTab {
  if (value === "interaction") {
    return canManageInteraction ? "interaction" : canAccessTeam ? "team" : "agents";
  }
  if (value === "users" || value === "roles" || value === "team") {
    return value;
  }
  return "agents";
}

type SettingsPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

async function SettingsContent({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const session = await requirePageAccess("/settings");
  const manageUsers = canManageUsers(session.user.role);
  const manageRoles = canManageRoles(session.user.role);
  const showTeam = canAccessTeamManagement(session.user.role);
  const canManageInteraction = canManageSettings(session.user.role);
  const initialTab = resolveInitialTab(
    params.tab,
    canManageInteraction,
    showTeam
  );

  const [interaction, agentsData, users, roles, teamData] = await Promise.all([
    canManageInteraction
      ? getInteractionConfigManagerData()
      : Promise.resolve(null),
    getAgentsForManagement(),
    manageUsers ? getUsers() : Promise.resolve([]),
    manageRoles ? getRoles() : Promise.resolve([]),
    showTeam ? getTeamManagementData() : Promise.resolve(null),
  ]);

  return (
    <SettingsManagement
      initialTab={initialTab}
      canManageUsers={manageUsers}
      canManageRoles={manageRoles}
      canAccessTeam={showTeam}
      teamData={teamData}
      users={users}
      roles={roles}
      agents={agentsData.agents}
      canManageAgents={canManageSettings(session.user.role)}
      interactionConfig={interaction?.config ?? null}
      interactionUpdatedAt={interaction?.updatedAt ?? ""}
      interactionConfigVersion={interaction?.configVersion ?? 0}
      canManageInteraction={canManageInteraction}
    />
  );
}

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  return (
    <PageFrame fill>
      <Suspense fallback={<SettingsPageSkeleton />}>
        <SettingsContent searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}
