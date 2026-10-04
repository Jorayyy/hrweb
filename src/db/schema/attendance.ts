import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { holidayKind } from "./config";

/** Durations are INTEGER SECONDS. Monetary values are INTEGER CENTAVOS. */

export const attendanceStatus = pgEnum("attendance_status", [
  "PRESENT",
  "ABSENT",
  "LEAVE",
  "HOLIDAY_UNWORKED",
  "REST_DAY_WORKED",
  "LWP",
  "SUSPENDED",
  "INCOMPLETE_PUNCH",
  "NOT_SCHEDULED",
  "HALF_DAY",
]);

export const attendanceSource = pgEnum("attendance_source", [
  "CSV",
  "MANUAL",
  "DEVICE",
  "RECOMPUTE",
]);

export const attendanceDay = pgTable(
  "attendance_day",
  {
    employeeId: bigint("employee_id", { mode: "number" }).notNull(),
    /** OPERATIONAL DATE = local calendar date of the shift anchor. */
    workDate: date("work_date", { mode: "string" }).notNull(),
    scheduleId: bigint("schedule_id", { mode: "number" }),

    status: attendanceStatus("status").notNull().default("PRESENT"),
    source: attendanceSource("source").notNull().default("CSV"),
    punchInUtc: timestamp("punch_in_utc", { withTimezone: true }),
    break1OutUtc: timestamp("break1_out_utc", { withTimezone: true }),
    break1InUtc: timestamp("break1_in_utc", { withTimezone: true }),
    lunchOutUtc: timestamp("lunch_out_utc", { withTimezone: true }),
    lunchInUtc: timestamp("lunch_in_utc", { withTimezone: true }),
    break2OutUtc: timestamp("break2_out_utc", { withTimezone: true }),
    break2InUtc: timestamp("break2_in_utc", { withTimezone: true }),
    punchOutUtc: timestamp("punch_out_utc", { withTimezone: true }),

    scheduledSeconds: bigint("scheduled_seconds", { mode: "number" }).notNull().default(0),
    workedSeconds: bigint("worked_seconds", { mode: "number" }).notNull().default(0),
    paidBreakSeconds: bigint("paid_break_seconds", { mode: "number" }).notNull().default(0),
    lateSeconds: bigint("late_seconds", { mode: "number" }).notNull().default(0),
    undertimeSeconds: bigint("undertime_seconds", { mode: "number" }).notNull().default(0),
    absentSeconds: bigint("absent_seconds", { mode: "number" }).notNull().default(0),
    otWorkedSeconds: bigint("ot_worked_seconds", { mode: "number" }).notNull().default(0),
    otApprovedSeconds: bigint("ot_approved_seconds", { mode: "number" }).notNull().default(0),
    nightSeconds: bigint("night_seconds", { mode: "number" }).notNull().default(0),
    nightOtSeconds: bigint("night_ot_seconds", { mode: "number" }).notNull().default(0),

    dayMultiplier: numeric("day_multiplier", { precision: 9, scale: 6, mode: "number" })
      .notNull()
      .default(1),
    otMultiplier: numeric("ot_multiplier", { precision: 9, scale: 6, mode: "number" })
      .notNull()
      .default(1),
    isRestDay: boolean("is_rest_day").notNull().default(false),
    holidayId: bigint("holiday_id", { mode: "number" }),
    holidayKind: holidayKind("holiday_kind").notNull().default("NONE"),
    /** Art. 94(c): present on the workday immediately preceding an unworked regular holiday. */
    presenceBeforeHoliday: boolean("presence_before_holiday").notNull().default(true),

    needsReview: boolean("needs_review").notNull().default(false),
    reviewNote: text("review_note"),
    ruleVersion: text("rule_version").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "attendance_day_pk", columns: [t.employeeId, t.workDate] }),
    index("ix_attendance_day_work_date").on(t.workDate),
    index("ix_attendance_day_review")
      .on(t.workDate)
      .where(sql`${t.needsReview}`),
  ],
);
