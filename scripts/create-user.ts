import "../env";
import { db } from "../src/db";
import { users, type UserRole } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

const ROLES: readonly string[] = ["ADMIN", "HR", "PAYROLL", "EMPLOYEE"];

async function main() {
  const [email, name, role, password] = process.argv.slice(2);

  if (!email || !name || !role || !password) {
    console.error(
      "usage: npm run user:create -- <email> <name> <ADMIN|HR|PAYROLL|EMPLOYEE> <password>",
    );
    process.exit(1);
  }
  if (!ROLES.includes(role)) {
    console.error(`invalid role "${role}" — expected one of ${ROLES.join(", ")}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const [row] = await db
    .insert(users)
    .values({ email: email.toLowerCase(), name, role: role as UserRole, passwordHash })
    .onConflictDoUpdate({
      target: users.email,
      set: { name, role: role as UserRole, passwordHash, updatedAt: new Date() },
    })
    .returning({ id: users.id });

  console.log(`user ready: ${email.toLowerCase()} role=${role} id=${row.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
