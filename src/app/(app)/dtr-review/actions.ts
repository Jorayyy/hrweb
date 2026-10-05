"use server";

import { redirect } from "next/navigation";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDay, employee } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { addDays, mondayOf, requiredDates, weekReadiness } from "@/lib/attendance/review";
import { field, isIsoDate } from "@/lib/form";
import { manilaDateKey } from "@/lib/time";

function back(w: string, error?: string, ok?: string): never {
  const qs = new URLSearchParams({ w });
  if (error) qs.set("error", error);
  if (ok) qs.set("ok", ok);
  redirect(`/dtr-review?${qs.toString()}`);
}

function parseWeek(formData: FormData): string | null {
  const w = field(formData, "w");
  if (!isIsoDate(w) || mondayOf(w) !== w) return null;
  return w;
}

const EMP_FIELDS = {
  id: employee.id,
  employeeNo: employee.employeeNo,
  firstName: employee.firstName,
  lastName: employee.lastName,
  dateHired: employee.dateHired,
  weeklyRestDays: employee.weeklyRestDays,
} as const;

export async function approveWeek(formData: FormData): Promise<never> {
  const user = await requireRole("ADMIN", "HR");
  const w = parseWeek(formData);
  if (!w) back(manilaDateKey(Date.now()), "Invalid week.");
  const to = addDays(w, 6);
  if (!(manilaDateKey(Date.now()) > to)) back(w, "This week has not ended yet.");

  const empId = Number(field(formData, "employeeId")) || 0;
  const now = new Date();

  if (empId) {
    const [emp] = await db.select(EMP_FIELDS).from(employee).where(eq(employee.id, empId)).limit(1);
    if (!emp) back(w, "Employee not found.");
    const rows = await db
      .select()
      .from(attendanceDay)
      .where(
        and(
          eq(attendanceDay.employeeId, empId),
          gte(attendanceDay.workDate, w),
          lte(attendanceDay.workDate, to),
        ),
      );
    const r = weekReadiness(
      requiredDates({ from: w, to, dateHired: emp.dateHired, weeklyRestDays: emp.weeklyRestDays }),
      rows,
    );
    if (r.missing.length > 0)
      back(
        w,
        `Missing DTR for ${emp.employeeNo} on ${r.missing.join(", ")} — add those days in Attendance first.`,
      );
    if (r.flagged.length > 0)
      back(w, `Flagged days must be fixed first: ${r.flagged.join(", ")}.`);

    await db
      .update(attendanceDay)
      .set({ reviewedBy: user.id, reviewedAt: now })
      .where(
        and(
          eq(attendanceDay.employeeId, empId),
          gte(attendanceDay.workDate, w),
          lte(attendanceDay.workDate, to),
        ),
      );
    back(w, undefined, `Approved week for ${emp.employeeNo}.`);
  }

  const emps = await db
    .select(EMP_FIELDS)
    .from(employee)
    .where(inArray(employee.status, ["ACTIVE", "ON_LEAVE"]))
    .orderBy(employee.lastName, employee.firstName);
  const rows = await db
    .select()
    .from(attendanceDay)
    .where(
      and(gte(attendanceDay.workDate, w), lte(attendanceDay.workDate, to)),
    );

  const byEmp = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byEmp.get(row.employeeId);
    if (list) list.push(row);
    else byEmp.set(row.employeeId, [row]);
  }

  const ready: number[] = [];
  for (const emp of emps) {
    const r = weekReadiness(
      requiredDates({ from: w, to, dateHired: emp.dateHired, weeklyRestDays: emp.weeklyRestDays }),
      byEmp.get(emp.id) ?? [],
    );
    if (r.ready && !r.approved) ready.push(emp.id);
  }

  if (ready.length > 0) {
    await db
      .update(attendanceDay)
      .set({ reviewedBy: user.id, reviewedAt: now })
      .where(
        and(
          inArray(attendanceDay.employeeId, ready),
          gte(attendanceDay.workDate, w),
          lte(attendanceDay.workDate, to),
        ),
      );
  }

  const skipped = emps.length - ready.length;
  back(
    w,
    undefined,
    `Approved ${ready.length} week${ready.length === 1 ? "" : "s"}` +
      (skipped > 0 ? ` — ${skipped} skipped (missing or flagged days).` : "."),
  );
}

export async function reopenWeek(formData: FormData): Promise<never> {
  await requireRole("ADMIN", "HR");
  const w = parseWeek(formData);
  if (!w) back(manilaDateKey(Date.now()), "Invalid week.");
  const to = addDays(w, 6);
  const empId = Number(field(formData, "employeeId")) || 0;
  if (!empId) back(w, "Employee is required.");

  await db
    .update(attendanceDay)
    .set({ reviewedBy: null, reviewedAt: null })
    .where(
      and(
        eq(attendanceDay.employeeId, empId),
        gte(attendanceDay.workDate, w),
        lte(attendanceDay.workDate, to),
      ),
    );
  back(w, undefined, "Reopened — days are editable again.");
}
