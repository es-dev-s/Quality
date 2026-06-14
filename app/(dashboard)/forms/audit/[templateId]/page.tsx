import { redirect } from "next/navigation";

type AuditFormTemplatePageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function AuditFormTemplatePage({
  params,
}: AuditFormTemplatePageProps) {
  const { templateId } = await params;
  redirect(`/forms/audit?template=${encodeURIComponent(templateId)}`);
}
