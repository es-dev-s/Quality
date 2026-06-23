import "dotenv/config";
import { prisma } from "@/lib/prisma";

const AMP = "Sales & Compliance";
const DOLLAR = "Sales $ Compliance";

async function main() {
  const chat = await prisma.formTemplate.findUnique({
    where: { id: "chat" },
    select: { id: true, name: true, sections: true, updatedAt: true },
  });

  if (!chat) {
    console.log("chat template not found");
    return;
  }

  console.log(`Template: ${chat.id} (${chat.name}) updated ${chat.updatedAt.toISOString()}\n`);

  const sections = chat.sections as {
    id: string;
    name: string;
    params: { id: string; name: string; cat: string }[];
  }[];

  for (const section of sections) {
    const sectionHasAmp = section.name.includes(AMP);
    const sectionHasDollar = section.name.includes(DOLLAR);
    if (!sectionHasAmp && !sectionHasDollar) continue;

    console.log(`Section id=${section.id}`);
    console.log(`  section.name: ${JSON.stringify(section.name)}`);

    const paramCats = new Set(section.params.map((p) => p.cat));
    console.log(`  param cat values: ${JSON.stringify([...paramCats])}`);
    console.log("");
  }

  // Count by template for submissions
  const grouped = await prisma.auditSubmission.groupBy({
    by: ["templateId"],
    _count: { _all: true },
  });
  console.log("Submissions by template:");
  for (const row of grouped) {
    console.log(`  ${row.templateId ?? "null"}: ${row._count._all}`);
  }
}

main().finally(() => prisma.$disconnect());
