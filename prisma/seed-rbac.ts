import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  ALL_PERMISSIONS,
  SYSTEM_ROLE_DEFINITIONS,
  type SystemRoleSlug,
} from "../lib/permissions";

function humanizePermission(slug: string): string {
  const [module, action] = slug.split(":");
  const moduleLabel = module.replace(/-/g, " ");
  return `${moduleLabel} — ${action}`;
}

export async function seedRbac(): Promise<void> {
  const scopeIds = new Map<string, string>();

  for (const permission of ALL_PERMISSIONS) {
    const scope = await prisma.scope.upsert({
      where: { slug: permission },
      update: {
        name: humanizePermission(permission),
        description: `Allows ${permission.replace(":", " ")} access`,
      },
      create: {
        slug: permission,
        name: humanizePermission(permission),
        description: `Allows ${permission.replace(":", " ")} access`,
      },
    });
    scopeIds.set(permission, scope.id);
  }

  for (const [slug, definition] of Object.entries(SYSTEM_ROLE_DEFINITIONS) as [
    SystemRoleSlug,
    (typeof SYSTEM_ROLE_DEFINITIONS)[SystemRoleSlug],
  ][]) {
    const role = await prisma.role.upsert({
      where: { slug },
      update: {
        name: definition.name,
        description: definition.description,
        isSystem: true,
      },
      create: {
        slug,
        name: definition.name,
        description: definition.description,
        isSystem: true,
      },
    });

    await prisma.roleScope.deleteMany({ where: { roleId: role.id } });

    const uniquePermissions = [...new Set(definition.permissions)];
    await prisma.roleScope.createMany({
      data: uniquePermissions.map((permission) => ({
        roleId: role.id,
        scopeId: scopeIds.get(permission)!,
      })),
      skipDuplicates: true,
    });
  }
}

async function main() {
  await seedRbac();
  console.log("RBAC seed completed.");
  console.log(`Scopes: ${ALL_PERMISSIONS.length}`);
  console.log(
    `Roles: ${Object.keys(SYSTEM_ROLE_DEFINITIONS).join(", ")}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
