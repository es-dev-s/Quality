import type { DefaultSession } from "next-auth";
import type { SessionRole } from "@/lib/rbac";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: SessionRole;
      sessionVersion?: number;
    } & DefaultSession["user"];
  }

  interface User {
    role: SessionRole;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: SessionRole;
    sessionVersion?: number;
  }
}
