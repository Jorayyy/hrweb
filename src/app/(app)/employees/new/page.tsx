import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { EmployeeForm } from "@/components/employee-form";
import { createEmployee } from "../actions";
import { ENUM_OPTIONS, employeeSelects } from "../queries";

export default async function NewEmployeePage() {
  await requireRole("ADMIN", "HR");

  const selects = await employeeSelects();
  const missing = [
    selects.costCenters.length === 0 && "cost centers",
    selects.campaigns.length === 0 && "campaigns",
    selects.departments.length === 0 && "departments",
    selects.positions.length === 0 && "job positions",
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <h1 className="text-2xl font-semibold">Add employee</h1>
        <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
          <p className="text-sm text-zinc-600">
            Create these first: <span className="font-medium">{missing.join(", ")}.</span>
          </p>
          <Link
            href="/setup"
            className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Go to setup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="text-2xl font-semibold">Add employee</h1>
      <p className="mt-1 text-sm text-zinc-500">Daily rate is derived as monthly ÷ 22, hourly as daily ÷ 8.</p>

      <div className="mt-8">
        <EmployeeForm
          action={createEmployee}
          selects={selects}
          enums={ENUM_OPTIONS}
          submitLabel="Create employee"
        />
      </div>
    </div>
  );
}
