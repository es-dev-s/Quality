/**
 * Inspect duplicate "Sales & Compliance" vs "Sales $ Compliance" in DB.
 * Run: npx tsx scripts/inspect-sales-compliance-names.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const AMP = "Sales & Compliance";
const DOLLAR = "Sales $ Compliance";

async function main() {
  const templates = await prisma.formTemplate.findMany({
    select: { id: true, name: true, sections: true, updatedAt: true },
  });

  console.log("=== form_templates ===");
  for (const template of templates) {
    const json = JSON.stringify(template.sections);
    const hasAmp = json.includes(AMP);
    const hasDollar = json.includes(DOLLAR);
    if (hasAmp || hasDollar) {
      console.log(
        `- ${template.id} (${template.name}) updated ${template.updatedAt.toISOString()}`
      );
      if (hasAmp) console.log(`    contains: ${AMP}`);
      if (hasDollar) console.log(`    contains: ${DOLLAR}`);
    }
  }

  const submissions = await prisma.auditSubmission.findMany({
    select: {
      id: true,
      auditCode: true,
      templateId: true,
      rows: true,
      catScores: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  let ampSubmissions = 0;
  let dollarSubmissions = 0;
  const ampExamples: string[] = [];
  const dollarExamples: string[] = [];

  const catScoreKeys = new Map<string, number>();
  const rowCatValues = new Map<string, number>();

  for (const submission of submissions) {
    const blob = JSON.stringify({
      rows: submission.rows,
      catScores: submission.catScores,
    });

    if (blob.includes(AMP)) {
      ampSubmissions += 1;
      if (ampExamples.length < 8) {
        ampExamples.push(
          `${submission.auditCode} template=${submission.templateId ?? "null"}`
        );
      }
    }
    if (blob.includes(DOLLAR)) {
      dollarSubmissions += 1;
      if (dollarExamples.length < 8) {
        dollarExamples.push(
          `${submission.auditCode} template=${submission.templateId ?? "null"}`
        );
      }
    }

    if (submission.catScores && typeof submission.catScores === "object") {
      for (const key of Object.keys(submission.catScores as object)) {
        if (/sales.*compliance/i.test(key)) {
          catScoreKeys.set(key, (catScoreKeys.get(key) ?? 0) + 1);
        }
      }
    }

    if (Array.isArray(submission.rows)) {
      for (const row of submission.rows as { cat?: string }[]) {
        if (row.cat && /sales.*compliance/i.test(row.cat)) {
          rowCatValues.set(row.cat, (rowCatValues.get(row.cat) ?? 0) + 1);
        }
      }
    }
  }

  console.log("\n=== audit_submissions ===");
  console.log(`Total submissions: ${submissions.length}`);
  console.log(`Submissions containing "${AMP}": ${ampSubmissions}`);
  console.log(`Examples: ${ampExamples.join(", ") || "none"}`);
  console.log(`Submissions containing "${DOLLAR}": ${dollarSubmissions}`);
  console.log(`Examples: ${dollarExamples.join(", ") || "none"}`);

  console.log("\n=== catScores keys (sales + compliance) ===");
  for (const [key, count] of catScoreKeys) {
    console.log(`  ${JSON.stringify(key)} -> ${count} audits`);
  }

  console.log("\n=== rows.cat values (sales + compliance) ===");
  for (const [key, count] of rowCatValues) {
    console.log(`  ${JSON.stringify(key)} -> ${count} parameter rows`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
