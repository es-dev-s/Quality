import { PERMISSIONS, type Permission } from "@/lib/permissions";

export type PermissionEntry = {
  slug: Permission;
  label: string;
  hint?: string;
};

export type PermissionGroup = {
  id: string;
  label: string;
  description?: string;
  permissions: PermissionEntry[];
};

/** Grouped scope catalog for custom role assignment UI. */
export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    permissions: [
      {
        slug: PERMISSIONS.OVERVIEW_READ,
        label: "View dashboard",
        hint: "KPI overview and summary widgets",
      },
    ],
  },
  {
    id: "audit-logs",
    label: "Audit Logs",
    permissions: [
      {
        slug: PERMISSIONS.AUDIT_LOGS_READ,
        label: "View audit logs",
      },
      {
        slug: PERMISSIONS.AUDIT_LOGS_WRITE,
        label: "Edit audit log records",
        hint: "Requires audit form write for submission edits",
      },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    permissions: [
      {
        slug: PERMISSIONS.ANALYTICS_READ,
        label: "View analytics",
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    permissions: [
      {
        slug: PERMISSIONS.REPORTS_READ,
        label: "View reports",
        hint: "With audit logs read, enables CSV export",
      },
    ],
  },
  {
    id: "audit-form",
    label: "Audit Form",
    permissions: [
      {
        slug: PERMISSIONS.AUDIT_FORM_READ,
        label: "View audit form",
      },
      {
        slug: PERMISSIONS.AUDIT_FORM_WRITE,
        label: "Submit audits",
      },
    ],
  },
  {
    id: "templates",
    label: "Audit Templates",
    permissions: [
      {
        slug: PERMISSIONS.AUDIT_TEMPLATES_READ,
        label: "View templates",
      },
      {
        slug: PERMISSIONS.AUDIT_TEMPLATES_WRITE,
        label: "Manage templates",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    permissions: [
      {
        slug: PERMISSIONS.SETTINGS_READ,
        label: "View settings",
      },
      {
        slug: PERMISSIONS.SETTINGS_WRITE,
        label: "Manage settings",
        hint: "Agents, interaction config, and platform settings",
      },
    ],
  },
  {
    id: "feedback",
    label: "Feedback",
    permissions: [
      {
        slug: PERMISSIONS.FEEDBACK_READ,
        label: "View feedback",
      },
      {
        slug: PERMISSIONS.FEEDBACK_STATUS,
        label: "Change feedback status",
        hint: "Agent/QA workflow transitions in audit logs",
      },
      {
        slug: PERMISSIONS.FEEDBACK_WRITE,
        label: "Full feedback control",
        hint: "Edit feedback fields and all status values",
      },
    ],
  },
  {
    id: "import",
    label: "Import",
    permissions: [
      {
        slug: PERMISSIONS.IMPORT_WRITE,
        label: "Import data",
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    permissions: [
      {
        slug: PERMISSIONS.ADMIN_USERS,
        label: "Manage users",
      },
      {
        slug: PERMISSIONS.ADMIN_ROLES,
        label: "Manage roles",
      },
      {
        slug: PERMISSIONS.USER_READ_SENSITIVE,
        label: "View sensitive user fields",
      },
    ],
  },
  {
    id: "team",
    label: "Team management",
    permissions: [
      {
        slug: PERMISSIONS.USERS_PROVISION_AGENT,
        label: "Request agent onboarding",
      },
      {
        slug: PERMISSIONS.USERS_APPROVE_AGENT,
        label: "Approve agent requests",
      },
      {
        slug: PERMISSIONS.USERS_PROVISION_ANALYST,
        label: "Request analyst onboarding",
      },
      {
        slug: PERMISSIONS.USERS_APPROVE_ANALYST,
        label: "Approve analyst requests",
      },
      {
        slug: PERMISSIONS.USERS_READ_MANAGED,
        label: "View managed users",
      },
      {
        slug: PERMISSIONS.USERS_MANAGE_MANAGED,
        label: "Manage managed users",
      },
      {
        slug: PERMISSIONS.AGENT_ASSIGN,
        label: "Assign agents to analysts",
      },
    ],
  },
];

export const ALL_CATALOG_PERMISSIONS: Permission[] = PERMISSION_CATALOG.flatMap(
  (group) => group.permissions.map((entry) => entry.slug)
);

export function isValidPermissionSlug(slug: string): slug is Permission {
  return ALL_CATALOG_PERMISSIONS.includes(slug as Permission);
}
