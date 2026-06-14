import { DashboardHeader } from "@/components/dashboard/header";

type PageFrameProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function PageFrame({ title, description, children }: PageFrameProps) {
  return (
    <div className="dashboard-main">
      <DashboardHeader title={title} description={description} />
      <div className="dashboard-content">{children}</div>
    </div>
  );
}
