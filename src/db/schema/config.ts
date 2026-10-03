import { bigint, boolean, date, index, numeric, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

/** All monetary values are INTEGER CENTAVOS. Rates are unitless numeric. */

export const holidayKind = pgEnum("holiday_kind", [
  "NONE",
  "REGULAR",
  "SPECIAL_NONWORKING",
  "SPECIAL_HALF_DAY",
  "LOCAL",
]);

/** Effective-dated SSS contribution schedule (RA 11199). */
export const sssSchedule = pgTable(
  "sss_schedule",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    totalRate: numeric("total_rate", { precision: 9, scale: 6, mode: "number" }).notNull(),
    eeRate: numeric("ee_rate", { precision: 9, scale: 6, mode: "number" }).notNull(),
    erRate: numeric("er_rate", { precision: 9, scale: 6, mode: "number" }).notNull(),
    mscMin: bigint("msc_min", { mode: "number" }).notNull(),
    mscMax: bigint("msc_max", { mode: "number" }).notNull(),
    mscStep: bigint("msc_step", { mode: "number" }).notNull(),
    wispThreshold: bigint("wisp_threshold", { mode: "number" }).notNull(),
    /** Employment Compensation is ER-only and tiered by MSC. */
    ecThreshold: bigint("ec_threshold", { mode: "number" }).notNull(),
    ecAmountLow: bigint("ec_amount_low", { mode: "number" }).notNull(),
    ecAmountHigh: bigint("ec_amount_high", { mode: "number" }).notNull(),
    sourceRef: text("source_ref").notNull(),
  },
  (t) => [index("ix_sss_schedule_from").on(t.effectiveFrom)],
);

/** PhilHealth premium (RA 11223 / UHC Act). */
export const phicSchedule = pgTable("phic_schedule", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  effectiveTo: date("effective_to", { mode: "string" }),
  premiumRate: numeric("premium_rate", { precision: 9, scale: 6, mode: "number" }).notNull(),
  baseFloor: bigint("base_floor", { mode: "number" }).notNull(),
  baseCeiling: bigint("base_ceiling", { mode: "number" }).notNull(),
  eeShare: numeric("ee_share", { precision: 9, scale: 6, mode: "number" }).notNull(),
  erShare: numeric("er_share", { precision: 9, scale: 6, mode: "number" }).notNull(),
  sourceRef: text("source_ref").notNull(),
});

/** Pag-IBIG / HDMF fund contribution (RA 9679). */
export const hdmfSchedule = pgTable("hdmf_schedule", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  effectiveTo: date("effective_to", { mode: "string" }),
  eeRate: numeric("ee_rate", { precision: 9, scale: 6, mode: "number" }).notNull(),
  erRate: numeric("er_rate", { precision: 9, scale: 6, mode: "number" }).notNull(),
  compCeiling: bigint("comp_ceiling", { mode: "number" }).notNull(),
  maxContribution: bigint("max_contribution", { mode: "number" }).notNull(),
  sourceRef: text("source_ref").notNull(),
});

/**
 * BIR graduated withholding table — ANNUAL only (NIRC s24 as amended by
 * RA 10963). Periodic tables are derived at calculation time by
 * multiply-by-divisor / divide-by-divisor, so a law change is one INSERT.
 */
export const birTaxTable = pgTable(
  "bir_tax_table",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    variant: text("variant", { enum: ["NON_MANAGERIAL", "MANAGERIAL"] })
      .notNull()
      .default("NON_MANAGERIAL"),
    bracketNo: numeric("bracket_no", { precision: 6, scale: 0, mode: "number" }).notNull(),
    bracketFrom: bigint("bracket_from", { mode: "number" }).notNull(),
    bracketTo: bigint("bracket_to", { mode: "number" }),
    baseTax: bigint("base_tax", { mode: "number" }).notNull(),
    marginalRate: numeric("marginal_rate", { precision: 9, scale: 6, mode: "number" }).notNull(),
    overAmount: bigint("over_amount", { mode: "number" }).notNull(),
    sourceRef: text("source_ref").notNull(),
  },
  (t) => [uniqueIndex("ux_bir_bracket").on(t.variant, t.effectiveFrom, t.bracketNo)],
);

/**
 * Premium multipliers by (day kind x rest day x worked). Stored as data so a
 * DOLE ruling change never requires a deploy.
 */
export const premiumMatrix = pgTable(
  "premium_matrix",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    holidayKind: holidayKind("holiday_kind").notNull(),
    isRestDay: boolean("is_rest_day").notNull(),
    worked: boolean("worked").notNull(),
    first8hMultiplier: numeric("first_8h_multiplier", { precision: 9, scale: 6, mode: "number" }).notNull(),
    otHourMultiplier: numeric("ot_hour_multiplier", { precision: 9, scale: 6, mode: "number" }).notNull(),
    nsdApplies: boolean("nsd_applies").notNull().default(true),
    payWhenUnworked: boolean("pay_when_unworked").notNull().default(false),
    sourceRef: text("source_ref").notNull(),
  },
  (t) => [uniqueIndex("ux_premium_matrix").on(t.effectiveFrom, t.holidayKind, t.isRestDay, t.worked)],
);

export const holidayCalendar = pgTable(
  "holiday_calendar",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    holidayDate: date("holiday_date", { mode: "string" }).notNull(),
    kind: holidayKind("kind").notNull(),
    name: text("name").notNull(),
    proclamation: text("proclamation"),
    effectiveYear: numeric("effective_year", { precision: 5, scale: 0, mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("ux_holiday").on(t.holidayDate, t.name), index("ix_holiday_year").on(t.effectiveYear)],
);

export const allowanceType = pgTable("allowance_type", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  taxable: boolean("taxable").notNull(),
  monthlyCap: bigint("monthly_cap", { mode: "number" }),
  annualCap: bigint("annual_cap", { mode: "number" }),
  isFixed: boolean("is_fixed").notNull().default(true),
});

export const employeeAllowance = pgTable(
  "employee_allowance",
  {
    employeeId: bigint("employee_id", { mode: "number" }).notNull(),
    allowanceId: bigint("allowance_id", { mode: "number" })
      .notNull()
      .references(() => allowanceType.id),
    amount: bigint("amount", { mode: "number" }).notNull(),
    frequency: text("frequency", {
      enum: ["SEMI_MONTHLY", "MONTHLY", "WEEKLY", "DAILY"],
    })
      .notNull()
      .default("MONTHLY"),
    validFrom: date("valid_from", { mode: "string" }).notNull(),
    validTo: date("valid_to", { mode: "string" }),
  },
  (t) => [
    uniqueIndex("ux_employee_allowance").on(t.employeeId, t.allowanceId, t.validFrom),
    index("ix_employee_allowance_active").on(t.employeeId),
  ],
);
