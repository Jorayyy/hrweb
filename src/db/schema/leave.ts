import { bigint, boolean, date, index, numeric, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { employee, users } from "./org";

export const leaveStatus = pgEnum("leave_status", ["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

/** Config row per leave code (VL, SL, …). Unpaid types post to payroll as LWP. */
export const leaveType = pgTable("leave_type", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isPaid: boolean("is_paid").notNull().default(true),
  /** Days per calendar year. Balance is computed: entitlement − approved days. */
  annualDays: numeric("annual_days", { precision: 5, scale: 2, mode: "number" }).notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
});

export const leaveRequest = pgTable(
  "leave_request",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    employeeId: bigint("employee_id", { mode: "number" }).notNull().references(() => employee.id),
    leaveTypeId: bigint("leave_type_id", { mode: "number" }).notNull().references(() => leaveType.id),
    dateFrom: date("date_from", { mode: "string" }).notNull(),
    dateTo: date("date_to", { mode: "string" }).notNull(),
    /** Workdays in range (rest days and holidays excluded) at filing time. */
    days: numeric("days", { precision: 5, scale: 2, mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    status: leaveStatus("status").notNull().default("PENDING"),
    filedBy: text("filed_by").notNull().references(() => users.id),
    filedAt: timestamp("filed_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
  },
  (t) => [index("ix_leave_request_employee").on(t.employeeId), index("ix_leave_request_status").on(t.status)],
);
