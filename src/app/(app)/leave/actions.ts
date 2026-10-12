"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDay, employee, holidayCalendar, leaveRequest, leaveType } from "@/db/schema";
import { requireRole, selfEmployee } from "@/lib/auth";
import { field, isIsoDate, type FormState } from "@/lib/form";
import { rangesOverlap, workdays } from "@/lib/leave";

const STAFF = ["OWNER", "ADMIN", "HR"] as const;

function back(error?: string, ok?: string): never {
  const qs = new URLSearchParams();
  if (error) qs.set("error", error);
  if (ok) qs.set("ok", ok);
  const suffix = qs.toString();
  redirect(suffix ? `/leave?${suffix}` : "/leave");
}

async function holidaySet(from: string, to: string): Promise<Set<string>> {
  const rows = await db
    .select({ d: holidayCalendar.holidayDate })
    .from(holidayCalendar)
    .where(and(gte(holidayCalendar.holidayDate, from), lte(holidayCalendar.holidayDate, to)));
  return new Set(rows.map((r) => r.d));
}

export async function fileLeave(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole();
  const isStaff = (STAFF as readonly string[]).includes(user.role);

  let employeeId = Number(field(formData, "employeeId")) || 0;
  if (!employeeId) {
    const self = await selfEmployee();
    employeeId = self.employeeId ?? 0;
    if (!employeeId) return { error: "No employee profile linked to this account — see HR." };
  } else if (!isStaff) {
    return { error: "You can only file leave for yourself." };
  }

  const leaveTypeId = Number(field(formData, "leaveTypeId")) || 0;
  const dateFrom = field(formData, "dateFrom");
  const dateTo = field(formData, "dateTo");
  const reason = field(formData, "reason");

  const errors: Record<string, string> = {};
  if (!leaveTypeId) errors.leaveTypeId = "Leave type is required.";
  if (!isIsoDate(dateFrom)) errors.dateFrom = "A valid start date is required.";
  if (!isIsoDate(dateTo)) errors.dateTo = "A valid end date is required.";
  if (isIsoDate(dateFrom) && isIsoDate(dateTo) && dateTo < dateFrom)
    errors.dateTo = "End date must be on or after start date.";
  if (!reason) errors.reason = "Reason is required.";
  if (Object.keys(errors).length > 0) return { errors };

  const [emp] = await db
    .select({ id: employee.id, weeklyRestDays: employee.weeklyRestDays })
    .from(employee)
    .where(eq(employee.id, employeeId))
    .limit(1);
  if (!emp) return { errors: { employeeId: "Employee not found." } };

  const [type] = await db
    .select()
    .from(leaveType)
    .where(and(eq(leaveType.id, leaveTypeId), eq(leaveType.isActive, true)))
    .limit(1);
  if (!type) return { errors: { leaveTypeId: "Unknown leave type." } };

  const days = workdays(dateFrom, dateTo, emp.weeklyRestDays, await holidaySet(dateFrom, dateTo));
  if (days.length === 0)
    return { errors: { dateTo: "No working days in that range — rest days and holidays only." } };

  const clash = await db
    .select({ id: leaveRequest.id, status: leaveRequest.status, dateFrom: leaveRequest.dateFrom, dateTo: leaveRequest.dateTo })
    .from(leaveRequest)
    .where(
      and(
        eq(leaveRequest.employeeId, employeeId),
        inArray(leaveRequest.status, ["PENDING", "APPROVED"]),
      ),
    );
  const overlapping = clash.find((r) => rangesOverlap(dateFrom, dateTo, r.dateFrom, r.dateTo));
  if (overlapping)
    return { errors: { dateFrom: `Overlaps request #${overlapping.id} (${overlapping.status.toLowerCase()}).` } };

  await db.insert(leaveRequest).values({
    employeeId,
    leaveTypeId,
    dateFrom,
    dateTo,
    days: days.length,
    reason,
    filedBy: user.id,
  });

  revalidatePath("/leave");
  return { message: `Leave filed — ${days.length} day${days.length === 1 ? "" : "s"}, awaiting HR approval.` };
}

export async function approveLeave(formData: FormData): Promise<never> {
  const user = await requireRole("ADMIN", "HR");
  const id = Number(field(formData, "id")) || 0;
  if (!id) back("Missing request.");

  const [req] = await db
    .select({ request: leaveRequest, type: leaveType })
    .from(leaveRequest)
    .innerJoin(leaveType, eq(leaveRequest.leaveTypeId, leaveType.id))
    .where(eq(leaveRequest.id, id))
    .limit(1);
  if (!req) back("Request not found.");
  if (req.request.status !== "PENDING") back(`Request #${id} is already ${req.request.status.toLowerCase()}.`);

  const [emp] = await db
    .select({ weeklyRestDays: employee.weeklyRestDays })
    .from(employee)
    .where(eq(employee.id, req.request.employeeId))
    .limit(1);
  if (!emp) back("Employee not found.");

  const days = workdays(
    req.request.dateFrom,
    req.request.dateTo,
    emp.weeklyRestDays,
    await holidaySet(req.request.dateFrom, req.request.dateTo),
  );
  const status = req.type.isPaid ? "LEAVE" : "LWP";
  const now = new Date();
  let marked = 0;
  let skipped = 0;

  for (const d of days) {
    const [existing] = await db
      .select({ reviewedAt: attendanceDay.reviewedAt, punchInUtc: attendanceDay.punchInUtc, punchOutUtc: attendanceDay.punchOutUtc })
      .from(attendanceDay)
      .where(and(eq(attendanceDay.employeeId, req.request.employeeId), eq(attendanceDay.workDate, d)))
      .limit(1);
    if (existing?.reviewedAt || existing?.punchInUtc || existing?.punchOutUtc) {
      skipped++;
      continue;
    }
    const values = {
      employeeId: req.request.employeeId,
      workDate: d,
      status: status as "LEAVE" | "LWP",
      source: "MANUAL" as const,
      punchInUtc: null,
      break1OutUtc: null,
      break1InUtc: null,
      lunchOutUtc: null,
      lunchInUtc: null,
      break2OutUtc: null,
      break2InUtc: null,
      punchOutUtc: null,
      scheduleId: null,
      // shortcut: 8h placeholder — payroll counts LEAVE/LWP by day status, not seconds
      scheduledSeconds: 28_800,
      workedSeconds: 0,
      paidBreakSeconds: 0,
      lateSeconds: 0,
      undertimeSeconds: 0,
      absentSeconds: 0,
      otWorkedSeconds: 0,
      otApprovedSeconds: 0,
      nightSeconds: 0,
      nightOtSeconds: 0,
      dayMultiplier: 1,
      otMultiplier: 1,
      isRestDay: false,
      holidayId: null,
      holidayKind: "NONE" as const,
      presenceBeforeHoliday: true,
      needsReview: false,
      reviewNote: `${req.type.code} leave #${id}`,
      reviewedBy: null,
      reviewedAt: null,
      leaveRequestId: id,
      ruleVersion: "leave-1",
      computedAt: now,
    };
    await db
      .insert(attendanceDay)
      .values(values)
      .onConflictDoUpdate({ target: [attendanceDay.employeeId, attendanceDay.workDate], set: values });
    marked++;
  }

  await db
    .update(leaveRequest)
    .set({ status: "APPROVED", reviewedBy: user.id, reviewedAt: now })
    .where(eq(leaveRequest.id, id));

  revalidatePath("/leave");
  back(
    undefined,
    `Approved #${id} — ${marked} day${marked === 1 ? "" : "s"} marked ${status}` +
      (skipped > 0 ? `, ${skipped} skipped (punched or already approved)` : "") +
      ".",
  );
}

export async function rejectLeave(formData: FormData): Promise<never> {
  const user = await requireRole("ADMIN", "HR");
  const id = Number(field(formData, "id")) || 0;
  if (!id) back("Missing request.");

  const [req] = await db
    .select({ status: leaveRequest.status })
    .from(leaveRequest)
    .where(eq(leaveRequest.id, id))
    .limit(1);
  if (!req) back("Request not found.");
  if (req.status !== "PENDING") back(`Request #${id} is already ${req.status.toLowerCase()}.`);

  await db
    .update(leaveRequest)
    .set({ status: "REJECTED", reviewedBy: user.id, reviewedAt: new Date() })
    .where(eq(leaveRequest.id, id));

  revalidatePath("/leave");
  back(undefined, `Rejected #${id}.`);
}

export async function cancelLeave(formData: FormData): Promise<never> {
  const user = await requireRole();
  const id = Number(field(formData, "id")) || 0;
  if (!id) back("Missing request.");

  const [req] = await db.select().from(leaveRequest).where(eq(leaveRequest.id, id)).limit(1);
  if (!req) back("Request not found.");
  const isStaff = (STAFF as readonly string[]).includes(user.role);
  if (!isStaff && req.filedBy !== user.id) back("You can only cancel your own requests.");
  if (req.status === "CANCELLED" || req.status === "REJECTED")
    back(`Request #${id} is already ${req.status.toLowerCase()}.`);
  if (req.status === "PENDING") {
    await db.update(leaveRequest).set({ status: "CANCELLED" }).where(eq(leaveRequest.id, id));
  } else {
    // Approved: pull back the auto-marked days, unless a week was approved over them.
    await db
      .delete(attendanceDay)
      .where(and(eq(attendanceDay.leaveRequestId, id), isNull(attendanceDay.reviewedAt)));
    await db
      .update(leaveRequest)
      .set({ status: "CANCELLED", reviewNote: "Cancelled after approval" })
      .where(eq(leaveRequest.id, id));
  }

  revalidatePath("/leave");
  back(undefined, `Request #${id} cancelled.`);
}
