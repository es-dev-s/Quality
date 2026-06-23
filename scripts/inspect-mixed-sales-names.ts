import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const chatSubs = await prisma.auditSubmission.findMany({
    where: { templateId: "chat" },
    select: { auditCode: true, catScores: true, rows: true },
  });

  let bothInSame = 0;
  const examples: string[] = [];

  for (const sub of chatSubs) {
    const blob = JSON.stringify({ catScores: sub.catScores, rows: sub.rows });
    const hasAmp = blob.includes("Sales & Compliance");
    const hasDollar = blob.includes("Sales $ Compliance");
    if (hasAmp && hasDollar) {
      bothInSame += 1;
      if (examples.length < 3) examples.push(sub.auditCode);
    }
  }

  console.log(`Chat audits with BOTH names in same record: ${bothInSame}`);
  console.log(`Examples: ${examples.join(", ") || "none"}`);

  const callSubs = await prisma.auditSubmission.findMany({
    where: { templateId: "call" },
    select: { auditCode: true, catScores: true },
    take: 1,
  });
  if (callSubs[0]) {
    console.log("\nSample call catScores keys:", Object.keys(callSubs[0].catScores as object));
  }
  if (chatSubs[0]) {
    console.log("Sample chat catScores keys:", Object.keys(chatSubs[0].catScores as object));
  }
}

main().finally(() => prisma.$disconnect());
