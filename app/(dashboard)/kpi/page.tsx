import { PageFrame } from "@/components/dashboard/page-frame";
import { KpiPanel } from "@/components/kpi/kpi-panel";
import { getKpiPageData } from "@/lib/actions/kpi";
import { requireSuperAdmin } from "@/lib/auth";

export default async function KpiPage() {
  await requireSuperAdmin();
  const data = await getKpiPageData();

  return (
    <PageFrame fill>
      <div className="kpi-page">
        <KpiPanel filterOptions={data.filterOptions} data={data} />
      </div>
    </PageFrame>
  );
}
