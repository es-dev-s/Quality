import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { SettingsPageSkeleton } from "@/components/dashboard/page-skeletons";
import { SettingsManagement } from "@/components/settings/settings-management";
import { QmsEmpty } from "@/components/analytics/qms-primitives";
import { getAgentsForManagement } from "@/lib/actions/agents";
import { getConnectedUsersOverview } from "@/lib/actions/user-connections";
import { getRoles, getRolesForSelect, getUsers } from "@/lib/actions/admin";
import { getTeamManagementData } from "@/lib/actions/user-provisioning";
import { getInteractionConfigManagerData } from "@/lib/actions/interaction-config";
import {
  isInvalidSessionError,
  invalidSessionRedirectReason,
  requirePageAccess,
} from "@/lib/auth-guards";
import { redirectForInvalidSession } from "@/lib/auth-redirects";
import { rethrowNextNavigation } from "@/lib/next-errors";
import {
  canAccessTeamManagement,
  canManageManagedUsers,
  canManageRoles,
  canManageSettings,
  canManageUsers,
  canRevealUserPasswords,
  canViewUserConnections,
} from "@/lib/rbac";
type SettingsTab =
  | "agents"
  | "interaction"
  | "users"
  | "roles"
  | "team"
  | "connected";

function resolveInitialTab(
  value: string | undefined,
  canManageInteraction: boolean,
  canAccessTeam: boolean,
  canViewConnections: boolean,
  canManageUsersTab: boolean,
  canManageRolesTab: boolean
): SettingsTab {
  if (value === "interaction") {
    return canManageInteraction ? "interaction" : canAccessTeam ? "team" : "agents";
  }
  if (value === "connected") {
    return canViewConnections ? "connected" : "agents";
  }
  if (value === "users") {
    return canManageUsersTab ? "users" : "agents";
  }
  if (value === "roles") {
    return canManageRolesTab ? "roles" : "agents";
  }
  if (value === "team") {
    return canAccessTeam ? "team" : "agents";
  }
  return "agents";
}

type SettingsPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

function serializeUsers(
  users: Awaited<ReturnType<typeof getUsers>>
) {
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    role: {
      id: user.role.id,
      name: user.role.name,
      slug: user.role.slug,
      isSystem: user.role.isSystem,
    },
    dateOfJoining: user.dateOfJoining,
    teamName: user.teamName,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  }));
}

function serializeRoles(roles: Awaited<ReturnType<typeof getRoles>>) {
  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    isSystem: role.isSystem,
    _count: role._count,
  }));
}

async function SettingsContent({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  try {
    const params = await searchParams;
    const session = await requirePageAccess("/settings");
    const manageUsers = canManageUsers(session.user.role);
    const revealPasswords = canRevealUserPasswords(session.user.role);
    const showUsersTab = manageUsers || revealPasswords;
    const manageRoles = canManageRoles(session.user.role);
    const showTeam = canAccessTeamManagement(session.user.role);
    const canTransferAgents = canManageManagedUsers(session.user.role);
    const canManageInteraction = canManageSettings(session.user.role);
    const showConnections = canViewUserConnections(session.user.role);
    const initialTab = resolveInitialTab(
      params.tab,
      canManageInteraction,
      showTeam,
      showConnections,
      showUsersTab,
      manageRoles
    );

    // Load only the active tab — fetching every tab blocked Settings for minutes.
    const [
      interaction,
      agentsData,
      users,
      roles,
      userFormRoles,
      teamData,
      connectedUsers,
    ] = await Promise.all([
      initialTab === "interaction" && canManageInteraction
        ? getInteractionConfigManagerData()
        : Promise.resolve(null),
      initialTab === "agents"
        ? getAgentsForManagement()
        : Promise.resolve({ agents: [], canManage: false }),
      initialTab === "users" && showUsersTab
        ? getUsers()
        : Promise.resolve([]),
      initialTab === "roles" && manageRoles
        ? getRoles()
        : Promise.resolve([]),
      initialTab === "users" && showUsersTab
        ? getRolesForSelect()
        : Promise.resolve([]),
      initialTab === "team" && showTeam
        ? getTeamManagementData()
        : Promise.resolve(null),
      initialTab === "connected" && showConnections
        ? getConnectedUsersOverview()
        : Promise.resolve([]),
    ]);

    const serializedRoles =
      roles.length > 0
        ? serializeRoles(roles as Awaited<ReturnType<typeof getRoles>>)
        : userFormRoles.map((role) => ({
            id: role.id,
            name: role.name,
            slug: role.slug,
            description: null as string | null,
            isSystem: role.isSystem,
            _count: { users: 0, scopes: role._count.scopes },
          }));

    return (
      <SettingsManagement
        initialTab={initialTab}
        canManageUsers={manageUsers}
        canRevealPasswords={revealPasswords}
        canManageRoles={manageRoles}
        canAccessTeam={showTeam}
        teamData={teamData}
        users={serializeUsers(users)}
        roles={serializedRoles}
        agents={agentsData.agents}
        canManageAgents={canManageSettings(session.user.role)}
        canTransferAgents={canTransferAgents}
        interactionConfig={interaction?.config ?? null}
        interactionUpdatedAt={interaction?.updatedAt ?? ""}
        interactionConfigVersion={interaction?.configVersion ?? 0}
        canManageInteraction={canManageInteraction}
        canViewConnections={showConnections}
        connectedUsers={connectedUsers}
      />
    );
  } catch (error) {
    rethrowNextNavigation(error);

    if (isInvalidSessionError(error)) {
      redirectForInvalidSession("/settings", invalidSessionRedirectReason(error));
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      redirectForInvalidSession("/settings", "session");
    }

    console.error("[settings] page failed:", error);
    return (
      <QmsEmpty message="Settings could not be loaded right now. Please refresh in a moment." />
    );
  }
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
