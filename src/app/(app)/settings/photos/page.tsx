import { sql } from "drizzle-orm";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { clearPhoto } from "../actions";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams?: Promise<{ msg?: string }>;
}) {
  await requireRole("OWNER");
  const params = (await searchParams) ?? {};
  const msg = (params.msg ?? "").trim();

  const rows = await db
    .select({
      id: employee.id,
      employeeNo: employee.employeeNo,
      firstName: employee.firstName,
      lastName: employee.lastName,
      hasPhoto: sql<boolean>`${employee.photo} is not null`,
    })
    .from(employee)
    .orderBy(employee.lastName, employee.firstName);

  const withPhoto = rows.filter((r) => r.hasPhoto).length;
  const missing = rows.length - withPhoto;
  const ordered = [...rows].sort((a, b) => Number(a.hasPhoto) - Number(b.hasPhoto));

  return (
    <>
      <PageHeader
        back
        title="Employee photos"
        description="Owner only — review profile photos and clear the ones that should not be shown"
      />
      <PageBody>
        {msg ? (
          <div className="mb-4 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            {msg}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Roster</CardTitle>
            <CardDescription>
              {withPhoto} with photo · {missing} missing — photos are uploaded from the employee
              edit form.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ordered.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <Avatar size="lg" className="shrink-0">
                    <AvatarImage src={`/api/employees/${r.id}/photo`} alt="" />
                    <AvatarFallback>
                      {r.firstName.charAt(0)}
                      {r.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.lastName}, {r.firstName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{r.employeeNo}</p>
                  </div>
                  {r.hasPhoto ? (
                    <form action={clearPhoto.bind(null, r.id)}>
                      <SubmitButton size="xs" variant="outline" confirmText={`Clear the photo for ${r.firstName} ${r.lastName}?`}>
                        Clear
                      </SubmitButton>
                    </form>
                  ) : (
                    <span className="text-xs text-muted-foreground">No photo</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
