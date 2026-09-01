import { PageFrame } from "@/components/dashboard/page-frame";
import { KpiPanel } from "@/components/kpi/kpi-panel";
import { getKpiData, getKpiFilterOptions } from "@/lib/actions/kpi";
import { requireSuperAdmin } from "@/lib/auth";

export default async function KpiPage() {
  await requireSuperAdmin();
  const [filterOptions, data] = await Promise.all([
    getKpiFilterOptions(),
    getKpiData(),
  ]);

  return (
    <PageFrame fill>
      <div className="kpi-page">
        <KpiPanel filterOptions={filterOptions} data={data} />
      </div>
    </PageFrame>
  );
}
