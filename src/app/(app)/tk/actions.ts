"use server";

import { redirect } from "next/navigation";
import { mondayOf } from "@/lib/attendance/review";
import { requireRole } from "@/lib/auth";
import { field, isIsoDate } from "@/lib/form";
import { manilaDateKey } from "@/lib/time";
import { attendanceStatus } from "@/db/schema";
import { saveAttendanceDay } from "../attendance/actions";

const PUNCH_FIELDS = [
  "punchIn",
  "break1Out",
  "break1In",
  "lunchOut",
  "lunchIn",
  "break2Out",
  "break2In",
  "punchOut",
] as const;

function back(w: string, error?: string, ok?: string): never {
  const qs = new URLSearchParams({ w });
  if (error) qs.set("error", error);
  if (ok) qs.set("ok", ok);
  redirect(`/tk?${qs.toString()}`);
}

function parse(formData: FormData): { w: string; employeeId: string; workDate: string } | null {
  const w = field(formData, "w");
  const employeeId = field(formData, "employeeId");
  const workDate = field(formData, "workDate");
  if (!isIsoDate(w) || mondayOf(w) !== w) return null;
  if (!/^\d+$/.test(employeeId) || !isIsoDate(workDate)) return null;
  return { w, employeeId, workDate };
}

function toForm(p: { employeeId: string; workDate: string }): FormData {
  const fd = new FormData();
  fd.set("employeeId", p.employeeId);
  fd.set("workDate", p.workDate);
  return fd;
}

export async function markAbsent(formData: FormData): Promise<never> {
  await requireRole("ADMIN", "HR");
  const p = parse(formData);
  if (!p) back(manilaDateKey(Date.now()), "Invalid request.");
  const fd = toForm(p);
  fd.set("status", "ABSENT");
  const res = await saveAttendanceDay(null, fd);
  if (res?.errors) back(p.w, Object.values(res.errors).join(" "));
  back(p.w, undefined, `Marked ${p.workDate} absent.`);
}

export async function savePunches(formData: FormData): Promise<never> {
  await requireRole("ADMIN", "HR");
  const p = parse(formData);
  if (!p) back(manilaDateKey(Date.now()), "Invalid request.");
  const status = field(formData, "status");
  if (!attendanceStatus.enumValues.includes(status as (typeof attendanceStatus.enumValues)[number]))
    back(p.w, "Unknown status.");
  const fd = toForm(p);
  fd.set("status", status);
  for (const name of PUNCH_FIELDS) fd.set(name, field(formData, name));
  const res = await saveAttendanceDay(null, fd);
  if (res?.errors) back(p.w, Object.values(res.errors).join(" "));
  back(p.w, undefined, `Saved punches for ${p.workDate}.`);
}
