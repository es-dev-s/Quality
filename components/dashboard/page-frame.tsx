import { DashboardToolbar } from "@/components/dashboard/header";

type PageFrameProps = {
  children?: React.ReactNode;
  /** Remove content padding — use for full-height forms */
  flush?: boolean;
  /** Fill remaining viewport height (settings, audit logs) */
  fill?: boolean;
  /** Optional toolbar actions (right side) */
  actions?: React.ReactNode;
};

export function PageFrame({ children, flush = false, fill = false, actions }: PageFrameProps) {
  const contentClass = [
    "dashboard-content",
    flush ? "dashboard-content--flush" : "",
    fill ? "dashboard-content--fill" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="dashboard-main">
      <DashboardToolbar actions={actions} />
      <div className={contentClass}>{children}</div>
    </div>
  );
}
