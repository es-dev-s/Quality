import type { DefaultSession } from "next-auth";
import type { SessionRole } from "@/lib/rbac";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: SessionRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: SessionRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: SessionRole;
  }
}
