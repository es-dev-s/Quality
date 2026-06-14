import "dotenv/config";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";

async function main() {
  const schema = z.object({ email: z.email(), password: z.string().min(1) });
  const creds = { email: "admin@example.com", password: "admin123" };
  const parsed = schema.safeParse(creds);
  console.log("zod parse:", parsed.success, parsed.success ? "" : parsed.error.issues);

  const user = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
    include: { role: { include: { scopes: { include: { scope: true } } } } },
  });
  console.log("user found:", !!user, user?.email, user?.role?.slug);

  if (user) {
    const valid = await bcrypt.compare("admin123", user.password);
    console.log("bcrypt valid:", valid);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
