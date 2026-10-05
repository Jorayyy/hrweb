"use server";

import { redirect } from "next/navigation";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDay, employee } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { addDays, mondayOf, requiredDates, weekReadiness } from "@/lib/attendance/review";
import { field, isIsoDate } from "@/lib/form";
import { manilaDateKey } from "@/lib/time";
import { saveAttendanceDay } from "../attendance/actions";

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

async function markAbsentDays(
  employeeId: number,
  dates: readonly string[],
): Promise<string | null> {
  for (const d of dates) {
    const fd = new FormData();
    fd.set("employeeId", String(employeeId));
    fd.set("workDate", d);
    fd.set("status", "ABSENT");
    const res = await saveAttendanceDay(null, fd);
    if (res?.errors) return Object.values(res.errors).join(" ");
  }
  return null;
}

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
    if (r.flagged.length > 0)
      back(
        w,
        `Flagged days must be fixed first in Timekeeping (TK): ${r.flagged.join(", ")}.`,
      );
    const absentErr = await markAbsentDays(empId, r.missing);
    if (absentErr) back(w, absentErr);

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
    back(
      w,
      undefined,
      `Approved week for ${emp.employeeNo}.` +
        (r.missing.length > 0
          ? ` ${r.missing.length} missing day${r.missing.length === 1 ? "" : "s"} marked absent.`
          : ""),
    );
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
  let absentDays = 0;
  let flaggedSkipped = 0;
  for (const emp of emps) {
    const r = weekReadiness(
      requiredDates({ from: w, to, dateHired: emp.dateHired, weeklyRestDays: emp.weeklyRestDays }),
      byEmp.get(emp.id) ?? [],
    );
    if (r.approved) continue;
    if (r.flagged.length > 0) {
      flaggedSkipped++;
      continue;
    }
    if (r.missing.length > 0) {
      const err = await markAbsentDays(emp.id, r.missing);
      if (err) back(w, `${emp.employeeNo}: ${err}`);
      absentDays += r.missing.length;
    }
    ready.push(emp.id);
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

  back(
    w,
    undefined,
    `Approved ${ready.length} week${ready.length === 1 ? "" : "s"}` +
      (absentDays > 0
        ? ` · ${absentDays} missing day${absentDays === 1 ? "" : "s"} marked absent`
        : "") +
      (flaggedSkipped > 0
        ? ` · ${flaggedSkipped} skipped (flagged days — fix in Timekeeping)`
        : "") +
      ".",
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
