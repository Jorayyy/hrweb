import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/money";
import { EmployeeForm } from "@/components/employee-form";
import { PageBody, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { updateEmployee } from "../actions";
import { ENUM_OPTIONS, employeeSelects } from "../queries";

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN", "HR");

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const [row, selects] = await Promise.all([
    db.select().from(employee).where(eq(employee.id, id)).limit(1),
    employeeSelects(),
  ]);
  const record = row[0];
  if (!record) notFound();

  const fullName = `${record.lastName}, ${record.firstName} ${record.middleName ?? ""}`.trim();

  return (
    <>
      <PageHeader
        title={fullName}
        description={`${record.employeeNo} · Hired ${formatDate(record.dateHired)}${
          record.dateSeparated ? ` · Separated ${formatDate(record.dateSeparated)}` : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <StatusBadge status={record.status} />
          <Button variant="outline" size="sm" asChild>
            <Link href="/employees">Back to list</Link>
          </Button>
        </div>
      </PageHeader>
      <PageBody>
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardContent className="pt-6">
              <EmployeeForm
                action={updateEmployee.bind(null, id)}
                initial={record}
                selects={selects}
                enums={ENUM_OPTIONS}
                submitLabel="Save changes"
              />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
