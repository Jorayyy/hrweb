import { requireRole } from "@/lib/auth";

export default async function EmployeesPage() {
  await requireRole("ADMIN", "HR");

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="text-2xl font-semibold">Employees</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Roster, employment contracts, salaries and statutory numbers.
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
        No employees yet. Seeded data is intentionally off.
      </div>
    </div>
  );
}
