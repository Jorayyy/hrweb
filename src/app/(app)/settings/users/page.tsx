import { desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { employee, users, userRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectCx } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resetPassword, revokeSessions, setEmployee, setRole, toggleActive } from "../actions";
import { CreateUserForm } from "./create-form";

function titleize(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ msg?: string; err?: string }>;
}) {
  const actor = await requireRole("OWNER");
  const params = (await searchParams) ?? {};
  const msg = (params.msg ?? "").trim();
  const err = (params.err ?? "").trim();

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const activeOwners = rows.filter((r) => r.role === "OWNER" && r.isActive).length;

  const roster = await db
    .select({
      id: employee.id,
      label: employee.employeeNo,
      name: employee.lastName,
      firstName: employee.firstName,
    })
    .from(employee)
    .where(isNull(employee.dateSeparated))
    .orderBy(employee.employeeNo);

  const linkedIds = new Set(rows.map((r) => r.employeeId).filter((v): v is number => v != null));
  const available = roster.filter((e) => !linkedIds.has(e.id)).map((e) => ({
    id: e.id,
    label: `${e.label} — ${e.firstName} ${e.name}`,
  }));
  const empById = new Map(roster.map((e) => [e.id, e]));

  return (
    <>
      <PageHeader
        back
        title="User accounts"
        description="Owner only — accounts, roles, passwords and live sessions"
      />
      <PageBody>
        {msg ? (
          <div className="mb-4 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            {msg}
          </div>
        ) : null}
        {err ? (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        ) : null}

        <div className="grid gap-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Create account</CardTitle>
              <CardDescription>
                The new employee signs in with this email and the password you set here — they can
                change it from Security.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateUserForm roles={userRole.enumValues} employees={available} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>
                {rows.length} account{rows.length === 1 ? "" : "s"} · {activeOwners} active owner
                {activeOwners === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reset password</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const isSelf = r.id === actor.id;
                    const lastOwner = r.role === "OWNER" && r.isActive && activeOwners <= 1;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <span className="block font-medium">{r.name}</span>
                          <span className="block text-xs text-muted-foreground">{r.email}</span>
                        </TableCell>
                        <TableCell>
                          <form action={setRole.bind(null, r.id)} className="flex items-center gap-1.5">
                            <select
                              name="role"
                              defaultValue={r.role}
                              aria-label={`Role for ${r.name}`}
                              className={`${selectCx} h-7 w-32 text-xs`}
                            >
                              {userRole.enumValues.map((role) => (
                                <option key={role} value={role}>
                                  {titleize(role)}
                                </option>
                              ))}
                            </select>
                            <SubmitButton size="xs" variant="outline" disabled={isSelf}>
                              Set
                            </SubmitButton>
                          </form>
                        </TableCell>
                        <TableCell>
                          <form
                            action={setEmployee.bind(null, r.id)}
                            className="flex items-center gap-1.5"
                          >
                            <select
                              name="employeeId"
                              defaultValue={r.employeeId ? String(r.employeeId) : ""}
                              aria-label={`Employee link for ${r.name}`}
                              className={`${selectCx} h-7 w-40 text-xs`}
                            >
                              <option value="">Not linked</option>
                              {r.employeeId && empById.has(r.employeeId) ? (
                                <option value={r.employeeId}>
                                  {empById.get(r.employeeId)!.label} —{" "}
                                  {empById.get(r.employeeId)!.firstName}{" "}
                                  {empById.get(r.employeeId)!.name}
                                </option>
                              ) : null}
                              {available.map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.label}
                                </option>
                              ))}
                            </select>
                            <SubmitButton size="xs" variant="outline">
                              Set
                            </SubmitButton>
                          </form>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.isActive ? "default" : "secondary"}>
                            {r.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <form
                            action={resetPassword.bind(null, r.id)}
                            className="flex items-center gap-1.5"
                          >
                            <Input
                              name="password"
                              type="password"
                              autoComplete="new-password"
                              placeholder="New password"
                              aria-label={`New password for ${r.name}`}
                              className="h-7 w-36 text-xs"
                              disabled={isSelf}
                            />
                            <SubmitButton size="xs" variant="outline" disabled={isSelf}>
                              Reset
                            </SubmitButton>
                          </form>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1.5">
                            <form action={toggleActive.bind(null, r.id)}>
                              <SubmitButton
                                size="xs"
                                variant={r.isActive ? "destructive" : "outline"}
                                disabled={isSelf || lastOwner}
                                confirmText={
                                  r.isActive
                                    ? `Deactivate ${r.name}? They will be signed out everywhere.`
                                    : undefined
                                }
                              >
                                {r.isActive ? "Deactivate" : "Activate"}
                              </SubmitButton>
                            </form>
                            <form action={revokeSessions.bind(null, r.id)}>
                              <SubmitButton
                                size="xs"
                                variant="outline"
                                disabled={isSelf}
                                confirmText={`Sign ${r.name} out of every device?`}
                              >
                                Revoke sessions
                              </SubmitButton>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
