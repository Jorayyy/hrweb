import { requireRole } from "@/lib/auth";

export default async function PayrollPage() {
  await requireRole("ADMIN", "PAYROLL");

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="text-2xl font-semibold">Payroll</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Periods, cutoff runs, registers and payslips.
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
        The engine is tested and seeded; the run screen comes next.
      </div>
    </div>
  );
}
