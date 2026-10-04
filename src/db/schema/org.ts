import {
  AnyPgColumn,
  bigint,
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { shiftTemplate } from "./config";

/**
 * MONEY CONVENTION — every column suffixed / named as a monetary amount is
 * stored as INTEGER CENTAVOS (bigint). Never floats, never numeric(18,4).
 * Format for display with Intl.NumberFormat("en-PH", { currency: "PHP" }).
 */

export const employmentStatus = pgEnum("employment_status", [
  "PREBOARDING",
  "ACTIVE",
  "SUSPENDED",
  "ON_LEAVE",
  "AWOL",
  "RETIRED",
  "TERMINATED",
  "REINSTATED",
]);

export const employmentType = pgEnum("employment_type", [
  "REGULAR",
  "PROBATIONARY",
  "PROJECT",
  "AGENCY",
  "PART_TIME",
  "APPRENTICE",
]);

export const payFrequency = pgEnum("pay_frequency", [
  "SEMI_MONTHLY",
  "MONTHLY",
  "WEEKLY",
  "DAILY",
]);

export const userRole = pgEnum("user_role", ["ADMIN", "HR", "PAYROLL", "EMPLOYEE"]);

export type UserRole = (typeof userRole.enumValues)[number];

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("EMPLOYEE"),
    employeeId: bigint("employee_id", { mode: "number" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ix_users_role").on(t.role)],
);

export const costCenter = pgTable(
  "cost_center",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    parentId: bigint("parent_id", { mode: "number" }).references(
      (): AnyPgColumn => costCenter.id,
    ),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("ix_cost_center_parent").on(t.parentId)],
);

export const campaign = pgTable(
  "campaign",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    clientName: text("client_name").notNull(),
    costCenterId: bigint("cost_center_id", { mode: "number" }).notNull().references(
      () => costCenter.id,
    ),
    otAuthorizationMode: text("ot_authorization_mode", {
      enum: ["MANAGER_APPROVAL", "AUTO", "SUPERVISOR_SELF"],
    })
      .notNull()
      .default("MANAGER_APPROVAL"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("ix_campaign_cost_center").on(t.costCenterId)],
);

export const department = pgTable(
  "department",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    costCenterId: bigint("cost_center_id", { mode: "number" }).notNull().references(
      () => costCenter.id,
    ),
    parentId: bigint("parent_id", { mode: "number" }).references(
      (): AnyPgColumn => department.id,
    ),
  },
  (t) => [index("ix_department_cost_center").on(t.costCenterId)],
);

export const jobPosition = pgTable("job_position", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  jobLevel: smallint("job_level").notNull().default(1),
  isManagerial: boolean("is_managerial").notNull().default(false),
});

export const employee = pgTable(
  "employee",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    employeeNo: text("employee_no").notNull().unique(),
    externalCode: text("external_code").notNull(),
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    lastName: text("last_name").notNull(),
    email: text("email").unique(),
    dateHired: date("date_hired", { mode: "string" }).notNull(),
    dateRegularized: date("date_regularized", { mode: "string" }),
    dateSeparated: date("date_separated", { mode: "string" }),

    status: employmentStatus("status").notNull().default("ACTIVE"),
    employmentType: employmentType("employment_type").notNull().default("REGULAR"),
    payFrequency: payFrequency("pay_frequency").notNull().default("SEMI_MONTHLY"),

    campaignId: bigint("campaign_id", { mode: "number" }).notNull().references(() => campaign.id),
    departmentId: bigint("department_id", { mode: "number" }).notNull().references(() => department.id),
    costCenterId: bigint("cost_center_id", { mode: "number" }).notNull().references(() => costCenter.id),
    positionId: bigint("position_id", { mode: "number" }).notNull().references(() => jobPosition.id),
    reportsToId: bigint("reports_to_id", { mode: "number" }).references(
      (): AnyPgColumn => employee.id,
    ),

    /** CENTAVOS. Daily = round(base/22), hourly = round(base/176) — computed in lib/rates. */
    baseSalaryMonthly: bigint("base_salary_monthly", { mode: "number" }).notNull(),

    tinNo: text("tin_no"),
    sssNo: text("sss_no"),
    philhealthNo: text("philhealth_no"),
    pagibigNo: text("pagibig_no"),
    rdoCode: text("rdo_code"),
    /** scrypt hash of the web-bundy kiosk PIN. */
    bundyPin: text("bundy_pin"),
    /** Shift template driving late/OT/break computation. */
    shiftTemplateId: bigint("shift_template_id", { mode: "number" }).references(() => shiftTemplate.id),
    isMinimumWageExempt: boolean("is_minimum_wage_exempt").notNull().default(false),
    isManagerialTaxTbl: boolean("is_managerial_tax_tbl").notNull().default(false),

    /** 0=Sun .. 6=Sat (Postgres dow) */
    weeklyRestDays: smallint("weekly_rest_days").array().notNull().default([0]),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_employee_lookup").on(t.campaignId, t.status),
    index("ix_employee_cost_center").on(t.costCenterId),
    index("ix_employee_manager").on(t.reportsToId),
    index("ix_employee_sss").on(t.sssNo),
    index("ix_employee_tin").on(t.tinNo),
    uniqueIndex("ux_employee_external").on(t.externalCode, t.campaignId),
  ],
);
