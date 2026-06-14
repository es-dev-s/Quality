import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { SUPERADMIN_ROLE_SLUG } from "../lib/constants";
import { seedRbac } from "./seed-rbac";

async function main() {
  await seedRbac();

  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME?.trim() || "Super Admin";

  if (!email || !password) {
    console.error(
      "Missing required env vars. Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env before running this script."
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("SUPERADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const superAdminRole = await prisma.role.findUnique({
    where: { slug: SUPERADMIN_ROLE_SLUG },
  });

  if (!superAdminRole) {
    console.error("Superadmin role missing after RBAC seed.");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      roleId: superAdminRole.id,
    },
    create: {
      name,
      email,
      password: hashedPassword,
      roleId: superAdminRole.id,
    },
  });

  console.log("Superadmin seed completed.");
  console.log(`Role:  ${SUPERADMIN_ROLE_SLUG}`);
  console.log(`Email: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
