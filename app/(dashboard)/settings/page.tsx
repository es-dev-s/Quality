import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { SettingsPageSkeleton } from "@/components/dashboard/page-skeletons";
import { SettingsManagement } from "@/components/settings/settings-management";
import { getAgentsForManagement } from "@/lib/actions/agents";
import { getRoles, getUsers } from "@/lib/actions/admin";
import { getInteractionConfigManagerData } from "@/lib/actions/interaction-config";
import { requirePageAccess } from "@/lib/auth-guards";
import {
  canManageRoles,
  canManageSettings,
  canManageUsers,
} from "@/lib/rbac";

type SettingsTab = "agents" | "interaction" | "users" | "roles";

function parseSettingsTab(value: string | undefined): SettingsTab {
  if (value === "interaction" || value === "users" || value === "roles") {
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
  const initialTab = parseSettingsTab(params.tab);

  const session = await requirePageAccess("/settings");
  const manageUsers = canManageUsers(session.user.role);
  const manageRoles = canManageRoles(session.user.role);

  const [interaction, agentsData, users, roles] = await Promise.all([
    getInteractionConfigManagerData(),
    getAgentsForManagement(),
    manageUsers ? getUsers() : Promise.resolve([]),
    manageRoles ? getRoles() : Promise.resolve([]),
  ]);

  return (
    <SettingsManagement
      initialTab={initialTab}
      canManageUsers={manageUsers}
      canManageRoles={manageRoles}
      users={users}
      roles={roles}
      agents={agentsData.agents}
      canManageAgents={canManageSettings(session.user.role)}
      interactionConfig={interaction.config}
      interactionUpdatedAt={interaction.updatedAt}
      interactionConfigVersion={interaction.configVersion}
      canManageInteraction={canManageSettings(session.user.role)}
    />
  );
}

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  return (
    <PageFrame
      title="Settings"
      description="Agents, users, roles, and interaction config for audit forms"
    >
      <Suspense fallback={<SettingsPageSkeleton />}>
        <SettingsContent searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}
