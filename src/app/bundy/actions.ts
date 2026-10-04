"use server";

import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { attendanceDay, employee } from "@/db/schema";
import { clientIp, isBundyIpAllowed } from "@/lib/bundy";
import { field, type FormState } from "@/lib/form";
import { verifyPassword } from "@/lib/password";
import { MANILA_OFFSET_MS, manilaDateKey, manilaDayOfWeek, nightOverlapSeconds } from "@/lib/time";

const RULE_VERSION = "att-2026.1";

const UNWORKED = ["ABSENT", "NOT_SCHEDULED", "HOLIDAY_UNWORKED", "LWP", "SUSPENDED"];

const pad = (n: number) => String(n).padStart(2, "0");

function manilaStamp(ms: number): string {
  const d = new Date(ms + MANILA_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export async function punch(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = clientIp(await headers());
  if (!(await isBundyIpAllowed(ip))) {
    return { error: "This device is not authorized to record punches." };
  }

  const employeeNo = field(formData, "employeeNo");
  const pin = field(formData, "pin");
  if (!employeeNo || !pin) return { error: "Employee no. and PIN are required." };

  const [emp] = await db
    .select({
      id: employee.id,
      status: employee.status,
      bundyPin: employee.bundyPin,
      weeklyRestDays: employee.weeklyRestDays,
    })
    .from(employee)
    .where(eq(employee.employeeNo, employeeNo))
    .limit(1);

  if (!emp || !emp.bundyPin || !(await verifyPassword(pin, emp.bundyPin))) {
    return { error: "Employee no. or PIN is incorrect." };
  }
  if (emp.status !== "ACTIVE" && emp.status !== "ON_LEAVE") {
    return { error: "This employee is not active." };
  }

  const now = Date.now();
  const nowUtc = new Date(now);
  const workDate = manilaDateKey(now);

  const [row] = await db
    .select()
    .from(attendanceDay)
    .where(and(eq(attendanceDay.employeeId, emp.id), eq(attendanceDay.workDate, workDate)))
    .limit(1);

  if (row?.punchInUtc && row.punchOutUtc) {
    return { error: "You already have a complete punch for today." };
  }

  if (!row?.punchInUtc) {
    if (row) {
      const updated = await db
        .update(attendanceDay)
        .set({
          punchInUtc: nowUtc,
          source: "DEVICE",
          status: UNWORKED.includes(row.status) ? "INCOMPLETE_PUNCH" : row.status,
          needsReview: true,
          reviewNote: "Punch out pending.",
          computedAt: nowUtc,
        })
        .where(
          and(
            eq(attendanceDay.employeeId, emp.id),
            eq(attendanceDay.workDate, workDate),
            isNull(attendanceDay.punchInUtc),
          ),
        )
        .returning({ workDate: attendanceDay.workDate });
      if (updated.length === 0) return { error: "Punch in was already recorded." };
    } else {
      const inserted = await db
        .insert(attendanceDay)
        .values({
          employeeId: emp.id,
          workDate,
          status: "INCOMPLETE_PUNCH",
          source: "DEVICE",
          punchInUtc: nowUtc,
          isRestDay: emp.weeklyRestDays.includes(manilaDayOfWeek(now)),
          needsReview: true,
          reviewNote: "Punch out pending.",
          ruleVersion: RULE_VERSION,
          computedAt: nowUtc,
        })
        .returning({ workDate: attendanceDay.workDate });
      if (inserted.length === 0) return { error: "Punch in was already recorded." };
    }
    return { message: `Punched in at ${manilaStamp(now)}.` };
  }

  const inMs = row.punchInUtc.getTime();
  const updated = await db
    .update(attendanceDay)
    .set({
      punchOutUtc: nowUtc,
      source: "DEVICE",
      status: row.isRestDay ? "REST_DAY_WORKED" : "PRESENT",
      workedSeconds: Math.max(0, Math.round((now - inMs) / 1000)),
      nightSeconds: nightOverlapSeconds(inMs, now),
      needsReview: false,
      reviewNote: null,
      computedAt: nowUtc,
    })
    .where(
      and(
        eq(attendanceDay.employeeId, emp.id),
        eq(attendanceDay.workDate, workDate),
        isNull(attendanceDay.punchOutUtc),
      ),
    )
    .returning({ workDate: attendanceDay.workDate });
  if (updated.length === 0) return { error: "Punch out was already recorded." };

  return { message: `Punched out at ${manilaStamp(now)}.` };
}
