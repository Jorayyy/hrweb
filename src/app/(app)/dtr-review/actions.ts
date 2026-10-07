"use server";

import { redirect } from "next/navigation";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDay, employee } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { addDays, mondayOf, parseDtrFilter, requiredDates, weekReadiness } from "@/lib/attendance/review";
import { field, isIsoDate } from "@/lib/form";
import { manilaDateKey } from "@/lib/time";
import { saveAttendanceDay } from "../attendance/actions";

function back(w: string, error?: string, ok?: string, f = ""): never {
  const qs = new URLSearchParams({ w });
  if (error) qs.set("error", error);
  if (ok) qs.set("ok", ok);
  const fl = parseDtrFilter(f);
  if (fl.campaignId) qs.set("campaign", String(fl.campaignId));
  if (fl.deptId) qs.set("dept", String(fl.deptId));
  if (fl.ccId) qs.set("cc", String(fl.ccId));
  if (fl.q) qs.set("q", fl.q);
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
  const f = field(formData, "f");
  if (!w) back(manilaDateKey(Date.now()), "Invalid week.", undefined, f);
  const to = addDays(w, 6);
  const today = manilaDateKey(Date.now());
  if (w > today) back(w, "This week has not started yet.", undefined, f);

  const empId = Number(field(formData, "employeeId")) || 0;
  const hasIds = formData.has("ids");
  const idSet = new Set(
    field(formData, "ids")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0),
  );
  const now = new Date();

  if (empId) {
    const [emp] = await db.select(EMP_FIELDS).from(employee).where(eq(employee.id, empId)).limit(1);
    if (!emp) back(w, "Employee not found.", undefined, f);
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
      today,
    );
    if (r.flagged.length > 0)
      back(
        w,
        `Flagged days must be fixed first in Timekeeping (TK): ${r.flagged.join(", ")}.`,
        undefined,
        f,
      );
    const toMark = r.missing.filter((d) => d < today);
    const absentErr = await markAbsentDays(empId, toMark);
    if (absentErr) back(w, absentErr, undefined, f);

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
        (toMark.length > 0
          ? ` ${toMark.length} missing day${toMark.length === 1 ? "" : "s"} marked absent.`
          : ""),
      f,
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
    .where(and(gte(attendanceDay.workDate, w), lte(attendanceDay.workDate, to)));

  const byEmp = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byEmp.get(row.employeeId);
    if (list) list.push(row);
    else byEmp.set(row.employeeId, [row]);
  }

  const targets = hasIds ? emps.filter((e) => idSet.has(e.id)) : emps;

  const ready: number[] = [];
  let absentDays = 0;
  let flaggedSkipped = 0;
  for (const emp of targets) {
    const r = weekReadiness(
      requiredDates({ from: w, to, dateHired: emp.dateHired, weeklyRestDays: emp.weeklyRestDays }),
      byEmp.get(emp.id) ?? [],
      today,
    );
    if (r.approved) continue;
    if (r.flagged.length > 0) {
      flaggedSkipped++;
      continue;
    }
    const toMark = r.missing.filter((d) => d < today);
    if (toMark.length > 0) {
      const err = await markAbsentDays(emp.id, toMark);
      if (err) back(w, `${emp.employeeNo}: ${err}`, undefined, f);
      absentDays += toMark.length;
    }
    await db
      .update(attendanceDay)
      .set({ reviewedBy: user.id, reviewedAt: now })
      .where(
        and(
          eq(attendanceDay.employeeId, emp.id),
          gte(attendanceDay.workDate, w),
          lte(attendanceDay.workDate, to),
        ),
      );
    ready.push(emp.id);
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
    f,
  );
}

export async function reopenWeek(formData: FormData): Promise<never> {
  await requireRole("ADMIN", "HR");
  const w = parseWeek(formData);
  const f = field(formData, "f");
  if (!w) back(manilaDateKey(Date.now()), "Invalid week.", undefined, f);
  const to = addDays(w, 6);
  const empId = Number(field(formData, "employeeId")) || 0;
  if (!empId) back(w, "Employee is required.", undefined, f);

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
  back(w, undefined, "Reopened — days are editable again.", f);
}
