import {
  AUDIT_FORM_ACCESS_ROLES,
  FORM_SUPERVISOR_AGENT_RULES,
} from "@/lib/audit/form-supervisor-agents";
import { SYSTEM_ROLE_DEFINITIONS } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions";

function hasFormRead(slug: string): boolean {
  const def = SYSTEM_ROLE_DEFINITIONS[slug as keyof typeof SYSTEM_ROLE_DEFINITIONS];
  return def?.permissions.includes(PERMISSIONS.AUDIT_FORM_READ) ?? false;
}

console.log("=== Audit form access by role ===\n");

let errors = 0;

for (const slug of Object.keys(SYSTEM_ROLE_DEFINITIONS) as Array<
  keyof typeof SYSTEM_ROLE_DEFINITIONS
>) {
  const canAccess = hasFormRead(slug);
  const expectedAccess = AUDIT_FORM_ACCESS_ROLES.includes(slug);
  const rules = FORM_SUPERVISOR_AGENT_RULES[slug];

  const status = canAccess === expectedAccess ? "OK" : "MISMATCH";
  if (status === "MISMATCH") errors += 1;

  console.log(`${SYSTEM_ROLE_DEFINITIONS[slug].name} (${slug})`);
  console.log(`  Form access (audit-form:read): ${canAccess ? "yes" : "no"} [${status}]`);
  if (canAccess) {
    console.log(`  Supervisors in dropdown: ${rules.supervisorScope}`);
    console.log(`  Agents when supervisor chosen: ${rules.agentScope}`);
  }
  console.log("");
}

console.log("=== Static verification complete ===\n");

async function main() {
  console.log("=== Summary ===");
  console.log(
    "Roles with form access:",
    AUDIT_FORM_ACCESS_ROLES.map((s) => SYSTEM_ROLE_DEFINITIONS[s].name).join(", ")
  );
  console.log(
    "Roles without form access:",
    "Agent, Supervisor (custom roles need audit-form:read scope)"
  );

  if (errors > 0) {
    console.error(`\n${errors} permission rule mismatch(es).`);
    process.exit(1);
  }

  console.log("\nAll static checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
