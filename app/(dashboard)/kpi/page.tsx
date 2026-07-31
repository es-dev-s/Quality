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
        <div className="admin-section-head">
          <div>
            <h1 className="admin-section-head__title">KPI</h1>
            <p className="admin-section-head__desc">
              Quality scorecard by period, Quality Manager portfolio, and QA —
              frequency vs target, coverage, IQA, and feedback.
            </p>
          </div>
        </div>
        <KpiPanel filterOptions={filterOptions} data={data} />
      </div>
    </PageFrame>
  );
}
