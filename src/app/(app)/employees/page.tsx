import Link from "next/link";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { campaign, employee, employmentStatus, jobPosition } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatPhp } from "@/lib/money";

const LIMIT = 100;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole("ADMIN", "HR");

  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim();
  const status = (params.status ?? "").trim();
  const statuses = employmentStatus.enumValues;
  const activeStatus = statuses.includes(status as (typeof statuses)[number]) ? status : "";

  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(employee.firstName, `%${q}%`),
        ilike(employee.lastName, `%${q}%`),
        ilike(employee.employeeNo, `%${q}%`),
      ),
    );
  }
  if (activeStatus) conditions.push(eq(employee.status, activeStatus as (typeof statuses)[number]));

  const rows = await db
    .select({
      id: employee.id,
      employeeNo: employee.employeeNo,
      firstName: employee.firstName,
      lastName: employee.lastName,
      status: employee.status,
      baseSalaryMonthly: employee.baseSalaryMonthly,
      campaignName: campaign.name,
      positionTitle: jobPosition.title,
    })
    .from(employee)
    .leftJoin(campaign, eq(employee.campaignId, campaign.id))
    .leftJoin(jobPosition, eq(employee.positionId, jobPosition.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(employee.lastName, employee.firstName)
    .limit(LIMIT + 1);

  const truncated = rows.length > LIMIT;
  const visible = truncated ? rows.slice(0, LIMIT) : rows;

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {visible.length === 0 ? "No employees yet." : `Showing ${visible.length} of ${truncated ? "100+" : visible.length}.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/setup"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Setup
          </Link>
          <Link
            href="/employees/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Add employee
          </Link>
        </div>
      </div>

      <form method="get" className="mt-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or employee no."
          className="w-72 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <select
          name="status"
          defaultValue={activeStatus}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s
                .split("_")
                .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
                .join(" ")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Filter
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">
            {q || activeStatus ? "Nothing matches those filters." : "No employees yet."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-5 py-2 font-medium">Employee no.</th>
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-5 py-2 font-medium">Campaign</th>
                <th className="px-5 py-2 font-medium">Position</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 text-right font-medium">Monthly</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-5 py-2">
                    <Link href={`/employees/${r.id}`} className="font-medium text-zinc-900 hover:underline">
                      {r.employeeNo}
                    </Link>
                  </td>
                  <td className="px-5 py-2">
                    {r.lastName}, {r.firstName}
                  </td>
                  <td className="px-5 py-2 text-zinc-600">{r.campaignName ?? "—"}</td>
                  <td className="px-5 py-2 text-zinc-600">{r.positionTitle ?? "—"}</td>
                  <td className="px-5 py-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{r.status}</span>
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums">{formatPhp(r.baseSalaryMonthly)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {truncated ? (
          <p className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
            Limited to {LIMIT} rows — refine the search to narrow it down.
          </p>
        ) : null}
      </div>
    </div>
  );
}
