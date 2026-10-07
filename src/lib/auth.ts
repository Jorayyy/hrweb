import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { noteSuccess } from "@/lib/lockout";
import { verifyPassword } from "@/lib/password";
import { getSecuritySettings } from "@/lib/settings";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 90 * 86_400 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!user || !user.isActive) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        await noteSuccess(`login:${email}`);

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) token.role = user.role;
      if (token.iat) {
        const { sessionTimeoutDays } = await getSecuritySettings();
        const hardExpiry = token.iat + sessionTimeoutDays * 86_400;
        if (!token.exp || token.exp > hardExpiry) token.exp = hardExpiry;
      }
      return token;
    },
    session: ({ session, token }) => {
      session.user.id = token.sub as string;
      session.user.role = token.role;
      return session;
    },
  },
});

/** Real authorization check — `proxy.ts` only confirms a cookie exists. */
export async function requireRole(...roles: UserRole[]) {
  const user = (await auth())?.user;
  if (!user) redirect("/login");
  if (roles.length > 0 && !roles.includes(user.role)) redirect("/");
  return user;
}

/** Session user + their linked employee id (null = profile not linked to an employee). */
export async function selfEmployee() {
  const user = await requireRole();
  const [acct] = await db
    .select({ employeeId: users.employeeId })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  return { user, employeeId: acct?.employeeId ?? null };
}
