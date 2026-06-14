import fs from "fs";
import path from "path";
import {
  parseAgentRosterFromFile,
  parseAgentRosterLines,
} from "@/lib/audit/agent-roster-data";

const mdPath = path.join(process.cwd(), "agent.md");
const content = fs.readFileSync(mdPath, "utf8");
const lines = content.split(/\r?\n/).filter((l) => l.trim());

console.log("agent.md lines (non-empty):", lines.length);
console.log("Header:", lines[0]);

const dataLines = lines.slice(1);
console.log("Data rows:", dataLines.length);

const { roster, duplicates, skipped } = parseAgentRosterLines(dataLines, {
  reportDuplicates: true,
  rowOffset: 2,
});

console.log("\nUnique agents:", roster.length);
console.log("Duplicate rows skipped:", duplicates.length);
for (const dup of duplicates) {
  console.log(
    `  - Row ${dup.row}: ${dup.name} (${dup.dateOfJoining}) — same as row ${dup.firstRow}`
  );
}
if (skipped.length) {
  console.log("Skipped invalid lines:", skipped);
}

const fromFile = parseAgentRosterFromFile(mdPath);
console.log("\nparseAgentRosterFromFile:", fromFile.length);
