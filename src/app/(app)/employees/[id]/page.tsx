import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/money";
import { EmployeeForm } from "@/components/employee-form";
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

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">{record.employeeNo}</div>
          <h1 className="mt-0.5 text-2xl font-semibold">
            {record.lastName}, {record.firstName} {record.middleName ?? ""}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Hired {formatDate(record.dateHired)}
            {record.dateSeparated ? ` · Separated ${formatDate(record.dateSeparated)}` : ""}
          </p>
        </div>
        <Link
          href="/employees"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Back to list
        </Link>
      </div>

      <div className="mt-8">
        <EmployeeForm
          action={updateEmployee.bind(null, id)}
          initial={record}
          selects={selects}
          enums={ENUM_OPTIONS}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
