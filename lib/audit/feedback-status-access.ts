import {
  FEEDBACK_STATUS_OPTIONS,
  type FeedbackStatus,
} from "@/lib/audit/feedback";
import { isDefinedSystemRole, PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { hasScope, isSuperAdmin, type SessionRole } from "@/lib/rbac";

/** QA sets feedback lifecycle start (Pending → Shared). */
export const QA_FEEDBACK_STATUSES: FeedbackStatus[] = ["Pending", "Shared"];

/** Agent responds after feedback is shared. */
export const AGENT_FEEDBACK_STATUSES: FeedbackStatus[] = [
  "Acknowledged",
  "Disputed",
];

export type FeedbackStatusOption = {
  value: FeedbackStatus;
  label: string;
  disabled?: boolean;
};

function statusOptions(statuses: FeedbackStatus[]): FeedbackStatusOption[] {
  return statuses.map((status) => ({ value: status, label: status }));
}

function usesAgentFeedbackWorkflow(role: SessionRole): boolean {
  if (hasScope(role, PERMISSIONS.FEEDBACK_WRITE)) return false;
  if (hasScope(role, PERMISSIONS.AUDIT_FORM_WRITE)) return false;
  if (role.slug === SYSTEM_ROLE_SLUGS.AGENT) return true;
  return (
    !isDefinedSystemRole(role.slug) &&
    hasScope(role, PERMISSIONS.FEEDBACK_STATUS) &&
    !hasScope(role, PERMISSIONS.AUDIT_FORM_WRITE)
  );
}

function usesQaFeedbackWorkflow(role: SessionRole): boolean {
  if (hasScope(role, PERMISSIONS.FEEDBACK_WRITE)) return false;
  if (role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) return true;
  return (
    hasScope(role, PERMISSIONS.FEEDBACK_STATUS) &&
    hasScope(role, PERMISSIONS.AUDIT_FORM_WRITE)
  );
}

export function canChangeFeedbackStatusInAuditLogs(
  role?: SessionRole | null
): boolean {
  if (!role) return false;
  if (isSuperAdmin(role)) return true;
  return (
    hasScope(role, PERMISSIONS.FEEDBACK_WRITE) ||
    hasScope(role, PERMISSIONS.FEEDBACK_STATUS)
  );
}

export function getAllowedFeedbackStatuses(
  role?: SessionRole | null
): FeedbackStatus[] {
  if (!role) return [];
  if (isSuperAdmin(role)) return [...FEEDBACK_STATUS_OPTIONS];
  if (hasScope(role, PERMISSIONS.FEEDBACK_WRITE)) {
    return [...FEEDBACK_STATUS_OPTIONS];
  }
  if (usesQaFeedbackWorkflow(role)) {
    return QA_FEEDBACK_STATUSES;
  }
  if (usesAgentFeedbackWorkflow(role)) {
    return AGENT_FEEDBACK_STATUSES;
  }
  return [];
}

export type FeedbackStatusSelectConfig = {
  showSelect: boolean;
  editable: boolean;
  options: FeedbackStatusOption[];
  selectValue: FeedbackStatus | "";
  /** When true, show the workflow status as read-only and use selectValue for the action picker. */
  awaitingResponse?: boolean;
  hint?: string;
};

function agentFeedbackConfig(current: FeedbackStatus): FeedbackStatusSelectConfig {
  if (current === "Shared") {
    return {
      showSelect: true,
      editable: true,
      awaitingResponse: true,
      options: statusOptions(AGENT_FEEDBACK_STATUSES),
      selectValue: "",
      hint: "Select Acknowledged or Disputed after reviewing shared feedback",
    };
  }

  if (current === "Acknowledged" || current === "Disputed") {
    return {
      showSelect: true,
      editable: true,
      options: statusOptions(AGENT_FEEDBACK_STATUSES),
      selectValue: current,
    };
  }

  return {
    showSelect: false,
    editable: false,
    options: [],
    selectValue: current,
    hint:
      current === "Pending"
        ? "Waiting for Quality Analyst to share feedback"
        : "Agent can respond only after feedback is shared",
  };
}

/** Dropdown config for one audit row (role + current status). */
export function getFeedbackStatusSelectConfig(
  role: SessionRole | null | undefined,
  current: FeedbackStatus
): FeedbackStatusSelectConfig {
  if (!role || !canChangeFeedbackStatusInAuditLogs(role)) {
    return {
      showSelect: false,
      editable: false,
      options: [],
      selectValue: current,
    };
  }

  if (isSuperAdmin(role) || hasScope(role, PERMISSIONS.FEEDBACK_WRITE)) {
    return {
      showSelect: true,
      editable: true,
      options: statusOptions([...FEEDBACK_STATUS_OPTIONS]),
      selectValue: current,
    };
  }

  if (usesQaFeedbackWorkflow(role)) {
    return {
      showSelect: true,
      editable: QA_FEEDBACK_STATUSES.includes(current),
      options: statusOptions(QA_FEEDBACK_STATUSES),
      selectValue: current,
      hint:
        current === "Acknowledged" || current === "Disputed"
          ? "Agent must respond after feedback is shared"
          : undefined,
    };
  }

  if (usesAgentFeedbackWorkflow(role)) {
    return agentFeedbackConfig(current);
  }

  return {
    showSelect: false,
    editable: false,
    options: [],
    selectValue: current,
  };
}

export function canEditFeedbackDateTimeForStatus(
  role: SessionRole | null | undefined,
  status: FeedbackStatus
): boolean {
  if (!role || status === "Pending") return false;
  if (isSuperAdmin(role)) return true;
  if (hasScope(role, PERMISSIONS.FEEDBACK_WRITE)) return true;
  if (usesQaFeedbackWorkflow(role)) {
    return status === "Shared";
  }
  if (usesAgentFeedbackWorkflow(role)) {
    return status === "Acknowledged" || status === "Disputed";
  }
  return false;
}

export function assertFeedbackStatusChangeAllowed(
  role: SessionRole | null | undefined,
  previous: FeedbackStatus,
  next: FeedbackStatus
): string | null {
  if (isSuperAdmin(role)) return null;

  if (role && hasScope(role, PERMISSIONS.FEEDBACK_WRITE)) {
    return null;
  }

  if (role && usesQaFeedbackWorkflow(role)) {
    if (!QA_FEEDBACK_STATUSES.includes(next)) {
      return "Quality Analyst can only set Pending or Shared.";
    }
    if (!QA_FEEDBACK_STATUSES.includes(previous)) {
      return "This feedback status cannot be changed at your role level.";
    }
    return null;
  }

  if (role && usesAgentFeedbackWorkflow(role)) {
    if (!AGENT_FEEDBACK_STATUSES.includes(next)) {
      return "Agents can only set Acknowledged or Disputed.";
    }
    if (previous === "Pending") {
      return "Feedback must be shared before you can respond.";
    }
    if (previous === "Shared") {
      return null;
    }
    if (previous === "Acknowledged" || previous === "Disputed") {
      return null;
    }
    return "This feedback status cannot be changed at your role level.";
  }

  return "You do not have permission to change feedback status.";
}
