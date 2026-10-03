import Link from "next/link";
import { requireRole } from "@/lib/auth";

const SECTIONS = [
  { href: "/employees", label: "Employees", desc: "Roster, contracts, salaries and statutory numbers." },
  { href: "/attendance", label: "Attendance", desc: "Biometric punches, shift matching and day assembly." },
  { href: "/payroll", label: "Payroll", desc: "Periods, cutoff runs, registers and payslips." },
];

export default async function Dashboard() {
  const user = await requireRole();

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Signed in as <span className="font-medium text-zinc-700">{user.role}</span>
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400"
          >
            <div className="font-medium">{s.label}</div>
            <div className="mt-1 text-sm text-zinc-500">{s.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
