import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { payFrequency, users } from "./org";

/** All money columns are INTEGER CENTAVOS. All durations are INTEGER SECONDS. */

export const payrollStatus = pgEnum("payroll_status", [
  "OPEN",
  "CUT_OFF",
  "CALCULATING",
  "CALCULATED",
  "REVIEW",
  "APPROVED",
  "POSTED",
  "VOID",
]);

export const lineKind = pgEnum("line_kind", [
  "EARNING",
  "DEDUCTION",
  "TAX",
  "EMPLOYER_CONTRIB",
  "REIMBURSEMENT",
  "ADJUSTMENT",
]);

export const taxableClass = pgEnum("taxable_class", [
  "TAXABLE",
  "NON_TAXABLE_DEMINIMIS",
  "NON_TAXABLE_STATUTORY",
  "EXEMPT",
]);

export const jobStatus = pgEnum("job_status", ["PENDING", "RUNNING", "DONE", "FAILED"]);

export const payrollPeriod = pgTable(
  "payroll_period",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /** '2026-10-A', '2026-10-B', '2026-W41', '2026-10-05' */
    periodCode: text("period_code").notNull().unique(),
    dateFrom: date("date_from", { mode: "string" }).notNull(),
    dateTo: date("date_to", { mode: "string" }).notNull(),
    cutoffAt: timestamp("cutoff_at", { withTimezone: true }).notNull(),
    payDate: date("pay_date", { mode: "string" }).notNull(),
    frequency: payFrequency("frequency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ix_payroll_period_range").on(t.dateFrom, t.dateTo)],
);

export const payrollRun = pgTable(
  "payroll_run",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    periodId: bigint("period_id", { mode: "number" })
      .notNull()
      .references(() => payrollPeriod.id),
    runNo: integer("run_no").notNull().default(1),
    status: payrollStatus("status").notNull().default("OPEN"),
    headcount: integer("headcount"),
    grossTotal: bigint("gross_total", { mode: "number" }),
    deductionTotal: bigint("deduction_total", { mode: "number" }),
    netTotal: bigint("net_total", { mode: "number" }),

    // effective-dated config snapshots — THE audit anchor
    sssScheduleId: bigint("sss_schedule_id", { mode: "number" }).notNull(),
    phicScheduleId: bigint("phic_schedule_id", { mode: "number" }).notNull(),
    hdmfScheduleId: bigint("hdmf_schedule_id", { mode: "number" }).notNull(),
    birTableEffectiveFrom: date("bir_table_effective_from", { mode: "string" }).notNull(),
    birTableVariant: text("bir_table_variant", { enum: ["NON_MANAGERIAL", "MANAGERIAL"] })
      .notNull()
      .default("NON_MANAGERIAL"),
    premiumMatrixEffectiveFrom: date("premium_matrix_effective_from", { mode: "string" }).notNull(),
    holidayYear: numeric("holiday_year", { precision: 5, scale: 0, mode: "number" }).notNull(),
    payruleVersion: text("payrule_version").notNull(),
    configSnapshot: jsonb("config_snapshot").notNull(),

    initiatedBy: text("initiated_by")
      .notNull()
      .references(() => users.id),
    approvedBy: text("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_payroll_run").on(t.periodId, t.runNo),
    index("ix_payroll_run_status").on(t.status).where(sql`${t.status} <> 'POSTED'`),
  ],
);

export const payrollRunItem = pgTable(
  "payroll_run_item",
  {
    runId: bigint("run_id", { mode: "number" })
      .notNull()
      .references(() => payrollRun.id),
    employeeId: bigint("employee_id", { mode: "number" }).notNull(),

    // --- frozen inputs ---
    daysWorked: numeric("days_worked", { precision: 7, scale: 2, mode: "number" }).notNull().default(0),
    daysAbsent: numeric("days_absent", { precision: 7, scale: 2, mode: "number" }).notNull().default(0),
    daysLeavePaid: numeric("days_leave_paid", { precision: 7, scale: 2, mode: "number" }).notNull().default(0),
    daysHolidayRh: numeric("days_holiday_rh", { precision: 7, scale: 2, mode: "number" }).notNull().default(0),
    daysHolidaySnw: numeric("days_holiday_snw", { precision: 7, scale: 2, mode: "number" }).notNull().default(0),
    hoursRegular: numeric("hours_regular", { precision: 8, scale: 2, mode: "number" }).notNull().default(0),
    hoursOtOrd: numeric("hours_ot_ord", { precision: 8, scale: 2, mode: "number" }).notNull().default(0),
    hoursOtRd: numeric("hours_ot_rd", { precision: 8, scale: 2, mode: "number" }).notNull().default(0),
    hoursOtSpecl: numeric("hours_ot_specl", { precision: 8, scale: 2, mode: "number" }).notNull().default(0),
    hoursOtRh: numeric("hours_ot_rh", { precision: 8, scale: 2, mode: "number" }).notNull().default(0),
    hoursOtRhRd: numeric("hours_ot_rh_rd", { precision: 8, scale: 2, mode: "number" }).notNull().default(0),
    hoursNsd: numeric("hours_nsd", { precision: 8, scale: 2, mode: "number" }).notNull().default(0),
    lateSeconds: bigint("late_seconds", { mode: "number" }).notNull().default(0),
    undertimeSeconds: bigint("undertime_seconds", { mode: "number" }).notNull().default(0),

    // --- outputs (CENTAVOS) ---
    basicPay: bigint("basic_pay", { mode: "number" }).notNull().default(0),
    otPay: bigint("ot_pay", { mode: "number" }).notNull().default(0),
    nsdPay: bigint("nsd_pay", { mode: "number" }).notNull().default(0),
    holidayPay: bigint("holiday_pay", { mode: "number" }).notNull().default(0),
    restDayPay: bigint("rest_day_pay", { mode: "number" }).notNull().default(0),
    otherEarnings: bigint("other_earnings", { mode: "number" }).notNull().default(0),
    grossPay: bigint("gross_pay", { mode: "number" }).notNull().default(0),
    taxablePay: bigint("taxable_pay", { mode: "number" }).notNull().default(0),
    totalDeductions: bigint("total_deductions", { mode: "number" }).notNull().default(0),
    totalEmployer: bigint("total_employer", { mode: "number" }).notNull().default(0),
    netPay: bigint("net_pay", { mode: "number" }).notNull().default(0),

    // --- statutory subtotals (remittance returns / BIR Alphalist) ---
    sssEe: bigint("sss_ee", { mode: "number" }).notNull().default(0),
    sssEr: bigint("sss_er", { mode: "number" }).notNull().default(0),
    sssWispEe: bigint("sss_wisp_ee", { mode: "number" }).notNull().default(0),
    sssWispEr: bigint("sss_wisp_er", { mode: "number" }).notNull().default(0),
    phicEe: bigint("phic_ee", { mode: "number" }).notNull().default(0),
    phicEr: bigint("phic_er", { mode: "number" }).notNull().default(0),
    hdmfEe: bigint("hdmf_ee", { mode: "number" }).notNull().default(0),
    hdmfEr: bigint("hdmf_er", { mode: "number" }).notNull().default(0),
    birTax: bigint("bir_tax", { mode: "number" }).notNull().default(0),

    status: text("status").notNull().default("CALCULATED"),
    calcEngineVer: text("calc_engine_ver").notNull(),
    calcAt: timestamp("calc_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "payroll_run_item_pk", columns: [t.runId, t.employeeId] }),
    index("ix_run_item_employee").on(t.employeeId, t.runId),
  ],
);

export const payrollLine = pgTable(
  "payroll_line",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    runId: bigint("run_id", { mode: "number" })
      .notNull()
      .references(() => payrollRun.id),
    employeeId: bigint("employee_id", { mode: "number" }).notNull(),
    code: text("code").notNull(),
    kind: lineKind("kind").notNull(),
    label: text("label").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    taxableClass: taxableClass("taxable_class").notNull().default("TAXABLE"),
    basisAmount: bigint("basis_amount", { mode: "number" }),
    rate: numeric("rate", { precision: 12, scale: 6, mode: "number" }),
    formula: text("formula"),
    sourceRef: text("source_ref"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("ix_payroll_line_run_emp").on(t.runId, t.employeeId, t.sortOrder),
    index("ix_payroll_line_code").on(t.runId, t.code),
  ],
);

export const payrollAdjustment = pgTable(
  "payroll_adjustment",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    runId: bigint("run_id", { mode: "number" })
      .notNull()
      .references(() => payrollRun.id),
    employeeId: bigint("employee_id", { mode: "number" }).notNull(),
    lineCode: text("line_code").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    approvedBy: text("approved_by")
      .notNull()
      .references(() => users.id),
    effectivePeriodId: bigint("effective_period_id", { mode: "number" })
      .notNull()
      .references(() => payrollPeriod.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ix_adjustment_run").on(t.runId, t.employeeId)],
);

export const payslipRevision = pgTable(
  "payslip_revision",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    runId: bigint("run_id", { mode: "number" })
      .notNull()
      .references(() => payrollRun.id),
    employeeId: bigint("employee_id", { mode: "number" }).notNull(),
    revision: integer("revision").notNull(),
    payload: jsonb("payload").notNull(),
    checksum: text("checksum").notNull(),
    renderedAt: timestamp("rendered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ux_payslip_revision").on(t.runId, t.employeeId, t.revision)],
);

/** Skip-locked worker queue. Claim is a single atomic UPDATE ... RETURNING. */
export const payrollJob = pgTable(
  "payroll_job",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    runId: bigint("run_id", { mode: "number" })
      .notNull()
      .references(() => payrollRun.id),
    employeeId: bigint("employee_id", { mode: "number" }).notNull(),
    shard: integer("shard").notNull(),
    attempt: integer("attempt").notNull().default(0),
    status: jobStatus("status").notNull().default("PENDING"),
    lockedBy: text("locked_by"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [
    uniqueIndex("ux_payroll_job").on(t.runId, t.employeeId),
    index("ix_payroll_job_claim").on(t.runId, t.shard, t.id).where(sql`${t.status} = 'PENDING'`),
  ],
);
