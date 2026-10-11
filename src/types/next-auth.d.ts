import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/db/schema";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: UserRole; tv?: number } & DefaultSession["user"];
  }
  interface User {
    role: UserRole;
    tokenVersion?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole;
    tv?: number;
  }
}
