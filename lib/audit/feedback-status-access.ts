import {
  FEEDBACK_STATUS_OPTIONS,
  type FeedbackStatus,
} from "@/lib/audit/feedback";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { isSuperAdmin, type SessionRole } from "@/lib/rbac";

/** QA sets feedback lifecycle start (Pending → Shared). */
export const QA_FEEDBACK_STATUSES: FeedbackStatus[] = ["Pending", "Shared"];

/** Agent responds after feedback is shared. */
export const AGENT_FEEDBACK_STATUSES: FeedbackStatus[] = [
  "Acknowledged",
  "Disputed",
];

export function canChangeFeedbackStatusInAuditLogs(
  role?: SessionRole | null
): boolean {
  if (!role) return false;
  if (isSuperAdmin(role)) return true;
  return (
    role.slug === SYSTEM_ROLE_SLUGS.AGENT ||
    role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
  );
}

export function getAllowedFeedbackStatuses(
  role?: SessionRole | null
): FeedbackStatus[] {
  if (!role) return [];
  if (isSuperAdmin(role)) return [...FEEDBACK_STATUS_OPTIONS];
  if (role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    return QA_FEEDBACK_STATUSES;
  }
  if (role.slug === SYSTEM_ROLE_SLUGS.AGENT) {
    return AGENT_FEEDBACK_STATUSES;
  }
  return [];
}

export type FeedbackStatusSelectConfig = {
  editable: boolean;
  options: FeedbackStatus[];
  selectValue: FeedbackStatus | "";
  placeholder?: string;
};

/** Dropdown config for one audit row (role + current status). */
export function getFeedbackStatusSelectConfig(
  role: SessionRole | null | undefined,
  current: FeedbackStatus
): FeedbackStatusSelectConfig {
  if (!role || !canChangeFeedbackStatusInAuditLogs(role)) {
    return { editable: false, options: [], selectValue: current };
  }

  if (isSuperAdmin(role)) {
    return {
      editable: true,
      options: [...FEEDBACK_STATUS_OPTIONS],
      selectValue: current,
    };
  }

  if (role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    const options = QA_FEEDBACK_STATUSES;
    return {
      editable: options.includes(current),
      options,
      selectValue: current,
    };
  }

  if (role.slug === SYSTEM_ROLE_SLUGS.AGENT) {
    const options = AGENT_FEEDBACK_STATUSES;
    if (current === "Pending") {
      return {
        editable: false,
        options,
        selectValue: current,
      };
    }
    if (current === "Shared") {
      return {
        editable: true,
        options,
        selectValue: "",
        placeholder: `${current} — select response`,
      };
    }
    return {
      editable: options.includes(current),
      options,
      selectValue: options.includes(current) ? current : "",
    };
  }

  return { editable: false, options: [], selectValue: current };
}

export function canEditFeedbackDateTimeForStatus(
  role: SessionRole | null | undefined,
  status: FeedbackStatus
): boolean {
  if (!role || status === "Pending") return false;
  if (isSuperAdmin(role)) return true;
  if (role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    return status === "Shared";
  }
  if (role.slug === SYSTEM_ROLE_SLUGS.AGENT) {
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

  if (role?.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    if (!QA_FEEDBACK_STATUSES.includes(next)) {
      return "Quality Analyst can only set Pending or Shared.";
    }
    if (!QA_FEEDBACK_STATUSES.includes(previous)) {
      return "This feedback status cannot be changed at your role level.";
    }
    return null;
  }

  if (role?.slug === SYSTEM_ROLE_SLUGS.AGENT) {
    if (!AGENT_FEEDBACK_STATUSES.includes(next)) {
      return "Agent can only set Acknowledged or Disputed.";
    }
    if (previous === "Pending") {
      return "Feedback must be Shared before you can acknowledge or dispute.";
    }
    return null;
  }

  return "You do not have permission to change feedback status.";
}
