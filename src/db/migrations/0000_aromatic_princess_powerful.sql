CREATE TYPE "public"."attendance_source" AS ENUM('CSV', 'MANUAL', 'DEVICE', 'RECOMPUTE');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('PRESENT', 'ABSENT', 'LEAVE', 'HOLIDAY_UNWORKED', 'REST_DAY_WORKED', 'LWP', 'SUSPENDED', 'INCOMPLETE_PUNCH', 'NOT_SCHEDULED', 'HALF_DAY');--> statement-breakpoint
CREATE TYPE "public"."holiday_kind" AS ENUM('NONE', 'REGULAR', 'SPECIAL_NONWORKING', 'SPECIAL_HALF_DAY', 'LOCAL');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('PREBOARDING', 'ACTIVE', 'SUSPENDED', 'ON_LEAVE', 'AWOL', 'RETIRED', 'TERMINATED', 'REINSTATED');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('REGULAR', 'PROBATIONARY', 'PROJECT', 'AGENCY', 'PART_TIME', 'APPRENTICE');--> statement-breakpoint
CREATE TYPE "public"."pay_frequency" AS ENUM('SEMI_MONTHLY', 'MONTHLY', 'WEEKLY', 'DAILY');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'HR', 'PAYROLL', 'EMPLOYEE');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('PENDING', 'RUNNING', 'DONE', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."line_kind" AS ENUM('EARNING', 'DEDUCTION', 'TAX', 'EMPLOYER_CONTRIB', 'REIMBURSEMENT', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."payroll_status" AS ENUM('OPEN', 'CUT_OFF', 'CALCULATING', 'CALCULATED', 'REVIEW', 'APPROVED', 'POSTED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."taxable_class" AS ENUM('TAXABLE', 'NON_TAXABLE_DEMINIMIS', 'NON_TAXABLE_STATUTORY', 'EXEMPT');--> statement-breakpoint
CREATE TABLE "attendance_day" (
	"employee_id" bigint NOT NULL,
	"work_date" date NOT NULL,
	"schedule_id" bigint,
	"status" "attendance_status" DEFAULT 'PRESENT' NOT NULL,
	"source" "attendance_source" DEFAULT 'CSV' NOT NULL,
	"punch_in_utc" timestamp with time zone,
	"punch_out_utc" timestamp with time zone,
	"scheduled_seconds" bigint DEFAULT 0 NOT NULL,
	"worked_seconds" bigint DEFAULT 0 NOT NULL,
	"paid_break_seconds" bigint DEFAULT 0 NOT NULL,
	"late_seconds" bigint DEFAULT 0 NOT NULL,
	"undertime_seconds" bigint DEFAULT 0 NOT NULL,
	"absent_seconds" bigint DEFAULT 0 NOT NULL,
	"ot_worked_seconds" bigint DEFAULT 0 NOT NULL,
	"ot_approved_seconds" bigint DEFAULT 0 NOT NULL,
	"night_seconds" bigint DEFAULT 0 NOT NULL,
	"night_ot_seconds" bigint DEFAULT 0 NOT NULL,
	"day_multiplier" numeric(9, 6) DEFAULT 1 NOT NULL,
	"ot_multiplier" numeric(9, 6) DEFAULT 1 NOT NULL,
	"is_rest_day" boolean DEFAULT false NOT NULL,
	"holiday_id" bigint,
	"holiday_kind" "holiday_kind" DEFAULT 'NONE' NOT NULL,
	"presence_before_holiday" boolean DEFAULT true NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_note" text,
	"rule_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_day_pk" PRIMARY KEY("employee_id","work_date")
);
--> statement-breakpoint
CREATE TABLE "allowance_type" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "allowance_type_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"taxable" boolean NOT NULL,
	"monthly_cap" bigint,
	"annual_cap" bigint,
	"is_fixed" boolean DEFAULT true NOT NULL,
	CONSTRAINT "allowance_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "bir_tax_table" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bir_tax_table_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"variant" text DEFAULT 'NON_MANAGERIAL' NOT NULL,
	"bracket_no" numeric(6, 0) NOT NULL,
	"bracket_from" bigint NOT NULL,
	"bracket_to" bigint,
	"base_tax" bigint NOT NULL,
	"marginal_rate" numeric(9, 6) NOT NULL,
	"over_amount" bigint NOT NULL,
	"source_ref" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_allowance" (
	"employee_id" bigint NOT NULL,
	"allowance_id" bigint NOT NULL,
	"amount" bigint NOT NULL,
	"frequency" text DEFAULT 'MONTHLY' NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date
);
--> statement-breakpoint
CREATE TABLE "hdmf_schedule" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hdmf_schedule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"ee_rate" numeric(9, 6) NOT NULL,
	"er_rate" numeric(9, 6) NOT NULL,
	"comp_ceiling" bigint NOT NULL,
	"max_contribution" bigint NOT NULL,
	"source_ref" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holiday_calendar" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "holiday_calendar_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"holiday_date" date NOT NULL,
	"kind" "holiday_kind" NOT NULL,
	"name" text NOT NULL,
	"proclamation" text,
	"effective_year" numeric(5, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phic_schedule" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "phic_schedule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"premium_rate" numeric(9, 6) NOT NULL,
	"base_floor" bigint NOT NULL,
	"base_ceiling" bigint NOT NULL,
	"ee_share" numeric(9, 6) NOT NULL,
	"er_share" numeric(9, 6) NOT NULL,
	"source_ref" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "premium_matrix" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "premium_matrix_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"holiday_kind" "holiday_kind" NOT NULL,
	"is_rest_day" boolean NOT NULL,
	"worked" boolean NOT NULL,
	"first_8h_multiplier" numeric(9, 6) NOT NULL,
	"ot_hour_multiplier" numeric(9, 6) NOT NULL,
	"nsd_applies" boolean DEFAULT true NOT NULL,
	"pay_when_unworked" boolean DEFAULT false NOT NULL,
	"source_ref" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sss_schedule" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sss_schedule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"total_rate" numeric(9, 6) NOT NULL,
	"ee_rate" numeric(9, 6) NOT NULL,
	"er_rate" numeric(9, 6) NOT NULL,
	"msc_min" bigint NOT NULL,
	"msc_max" bigint NOT NULL,
	"msc_step" bigint NOT NULL,
	"wisp_threshold" bigint NOT NULL,
	"ec_threshold" bigint NOT NULL,
	"ec_amount_low" bigint NOT NULL,
	"ec_amount_high" bigint NOT NULL,
	"source_ref" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaign_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"client_name" text NOT NULL,
	"cost_center_id" bigint NOT NULL,
	"ot_authorization_mode" text DEFAULT 'MANAGER_APPROVAL' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "campaign_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "cost_center" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cost_center_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "cost_center_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "department" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "department_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"cost_center_id" bigint NOT NULL,
	"parent_id" bigint,
	CONSTRAINT "department_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "employee" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"employee_no" text NOT NULL,
	"external_code" text NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"email" text,
	"date_hired" date NOT NULL,
	"date_regularized" date,
	"date_separated" date,
	"status" "employment_status" DEFAULT 'ACTIVE' NOT NULL,
	"employment_type" "employment_type" DEFAULT 'REGULAR' NOT NULL,
	"pay_frequency" "pay_frequency" DEFAULT 'SEMI_MONTHLY' NOT NULL,
	"campaign_id" bigint NOT NULL,
	"department_id" bigint NOT NULL,
	"cost_center_id" bigint NOT NULL,
	"position_id" bigint NOT NULL,
	"reports_to_id" bigint,
	"base_salary_monthly" bigint NOT NULL,
	"tin_no" text,
	"sss_no" text,
	"philhealth_no" text,
	"pagibig_no" text,
	"rdo_code" text,
	"is_minimum_wage_exempt" boolean DEFAULT false NOT NULL,
	"is_managerial_tax_tbl" boolean DEFAULT false NOT NULL,
	"weekly_rest_days" smallint[] DEFAULT '{0}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_employee_no_unique" UNIQUE("employee_no"),
	CONSTRAINT "employee_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "job_position" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_position_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"title" text NOT NULL,
	"job_level" smallint DEFAULT 1 NOT NULL,
	"is_managerial" boolean DEFAULT false NOT NULL,
	CONSTRAINT "job_position_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'EMPLOYEE' NOT NULL,
	"employee_id" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "payroll_adjustment" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payroll_adjustment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"run_id" bigint NOT NULL,
	"employee_id" bigint NOT NULL,
	"line_code" text NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text NOT NULL,
	"approved_by" text NOT NULL,
	"effective_period_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_job" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payroll_job_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"run_id" bigint NOT NULL,
	"employee_id" bigint NOT NULL,
	"shard" integer NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"status" "job_status" DEFAULT 'PENDING' NOT NULL,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "payroll_line" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payroll_line_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"run_id" bigint NOT NULL,
	"employee_id" bigint NOT NULL,
	"code" text NOT NULL,
	"kind" "line_kind" NOT NULL,
	"label" text NOT NULL,
	"amount" bigint NOT NULL,
	"taxable_class" "taxable_class" DEFAULT 'TAXABLE' NOT NULL,
	"basis_amount" bigint,
	"rate" numeric(12, 6),
	"formula" text,
	"source_ref" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_period" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payroll_period_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"period_code" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"cutoff_at" timestamp with time zone NOT NULL,
	"pay_date" date NOT NULL,
	"frequency" "pay_frequency" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_period_period_code_unique" UNIQUE("period_code")
);
--> statement-breakpoint
CREATE TABLE "payroll_run" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payroll_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"period_id" bigint NOT NULL,
	"run_no" integer DEFAULT 1 NOT NULL,
	"status" "payroll_status" DEFAULT 'OPEN' NOT NULL,
	"headcount" integer,
	"gross_total" bigint,
	"deduction_total" bigint,
	"net_total" bigint,
	"sss_schedule_id" bigint NOT NULL,
	"phic_schedule_id" bigint NOT NULL,
	"hdmf_schedule_id" bigint NOT NULL,
	"bir_table_effective_from" date NOT NULL,
	"bir_table_variant" text DEFAULT 'NON_MANAGERIAL' NOT NULL,
	"premium_matrix_effective_from" date NOT NULL,
	"holiday_year" numeric(5, 0) NOT NULL,
	"payrule_version" text NOT NULL,
	"config_snapshot" jsonb NOT NULL,
	"initiated_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_run_item" (
	"run_id" bigint NOT NULL,
	"employee_id" bigint NOT NULL,
	"days_worked" numeric(7, 2) DEFAULT 0 NOT NULL,
	"days_absent" numeric(7, 2) DEFAULT 0 NOT NULL,
	"days_leave_paid" numeric(7, 2) DEFAULT 0 NOT NULL,
	"days_holiday_rh" numeric(7, 2) DEFAULT 0 NOT NULL,
	"days_holiday_snw" numeric(7, 2) DEFAULT 0 NOT NULL,
	"hours_regular" numeric(8, 2) DEFAULT 0 NOT NULL,
	"hours_ot_ord" numeric(8, 2) DEFAULT 0 NOT NULL,
	"hours_ot_rd" numeric(8, 2) DEFAULT 0 NOT NULL,
	"hours_ot_specl" numeric(8, 2) DEFAULT 0 NOT NULL,
	"hours_ot_rh" numeric(8, 2) DEFAULT 0 NOT NULL,
	"hours_ot_rh_rd" numeric(8, 2) DEFAULT 0 NOT NULL,
	"hours_nsd" numeric(8, 2) DEFAULT 0 NOT NULL,
	"late_seconds" bigint DEFAULT 0 NOT NULL,
	"undertime_seconds" bigint DEFAULT 0 NOT NULL,
	"basic_pay" bigint DEFAULT 0 NOT NULL,
	"ot_pay" bigint DEFAULT 0 NOT NULL,
	"nsd_pay" bigint DEFAULT 0 NOT NULL,
	"holiday_pay" bigint DEFAULT 0 NOT NULL,
	"rest_day_pay" bigint DEFAULT 0 NOT NULL,
	"other_earnings" bigint DEFAULT 0 NOT NULL,
	"gross_pay" bigint DEFAULT 0 NOT NULL,
	"taxable_pay" bigint DEFAULT 0 NOT NULL,
	"total_deductions" bigint DEFAULT 0 NOT NULL,
	"total_employer" bigint DEFAULT 0 NOT NULL,
	"net_pay" bigint DEFAULT 0 NOT NULL,
	"sss_ee" bigint DEFAULT 0 NOT NULL,
	"sss_er" bigint DEFAULT 0 NOT NULL,
	"sss_wisp_ee" bigint DEFAULT 0 NOT NULL,
	"sss_wisp_er" bigint DEFAULT 0 NOT NULL,
	"phic_ee" bigint DEFAULT 0 NOT NULL,
	"phic_er" bigint DEFAULT 0 NOT NULL,
	"hdmf_ee" bigint DEFAULT 0 NOT NULL,
	"hdmf_er" bigint DEFAULT 0 NOT NULL,
	"bir_tax" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'CALCULATED' NOT NULL,
	"calc_engine_ver" text NOT NULL,
	"calc_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_run_item_pk" PRIMARY KEY("run_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "payslip_revision" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payslip_revision_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"run_id" bigint NOT NULL,
	"employee_id" bigint NOT NULL,
	"revision" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"rendered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_allowance" ADD CONSTRAINT "employee_allowance_allowance_id_allowance_type_id_fk" FOREIGN KEY ("allowance_id") REFERENCES "public"."allowance_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_cost_center_id_cost_center_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_center" ADD CONSTRAINT "cost_center_parent_id_cost_center_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."cost_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department" ADD CONSTRAINT "department_cost_center_id_cost_center_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department" ADD CONSTRAINT "department_parent_id_department_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_cost_center_id_cost_center_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_position_id_job_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."job_position"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_reports_to_id_employee_id_fk" FOREIGN KEY ("reports_to_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustment" ADD CONSTRAINT "payroll_adjustment_run_id_payroll_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustment" ADD CONSTRAINT "payroll_adjustment_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustment" ADD CONSTRAINT "payroll_adjustment_effective_period_id_payroll_period_id_fk" FOREIGN KEY ("effective_period_id") REFERENCES "public"."payroll_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_job" ADD CONSTRAINT "payroll_job_run_id_payroll_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_line" ADD CONSTRAINT "payroll_line_run_id_payroll_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD CONSTRAINT "payroll_run_period_id_payroll_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD CONSTRAINT "payroll_run_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD CONSTRAINT "payroll_run_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_item" ADD CONSTRAINT "payroll_run_item_run_id_payroll_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslip_revision" ADD CONSTRAINT "payslip_revision_run_id_payroll_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_attendance_day_work_date" ON "attendance_day" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "ix_attendance_day_review" ON "attendance_day" USING btree ("work_date") WHERE "attendance_day"."needs_review";--> statement-breakpoint
CREATE UNIQUE INDEX "ux_bir_bracket" ON "bir_tax_table" USING btree ("variant","effective_from","bracket_no");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_employee_allowance" ON "employee_allowance" USING btree ("employee_id","allowance_id","valid_from");--> statement-breakpoint
CREATE INDEX "ix_employee_allowance_active" ON "employee_allowance" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_holiday" ON "holiday_calendar" USING btree ("holiday_date","name");--> statement-breakpoint
CREATE INDEX "ix_holiday_year" ON "holiday_calendar" USING btree ("effective_year");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_premium_matrix" ON "premium_matrix" USING btree ("effective_from","holiday_kind","is_rest_day","worked");--> statement-breakpoint
CREATE INDEX "ix_sss_schedule_from" ON "sss_schedule" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "ix_campaign_cost_center" ON "campaign" USING btree ("cost_center_id");--> statement-breakpoint
CREATE INDEX "ix_cost_center_parent" ON "cost_center" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "ix_department_cost_center" ON "department" USING btree ("cost_center_id");--> statement-breakpoint
CREATE INDEX "ix_employee_lookup" ON "employee" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "ix_employee_cost_center" ON "employee" USING btree ("cost_center_id");--> statement-breakpoint
CREATE INDEX "ix_employee_manager" ON "employee" USING btree ("reports_to_id");--> statement-breakpoint
CREATE INDEX "ix_employee_sss" ON "employee" USING btree ("sss_no");--> statement-breakpoint
CREATE INDEX "ix_employee_tin" ON "employee" USING btree ("tin_no");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_employee_external" ON "employee" USING btree ("external_code","campaign_id");--> statement-breakpoint
CREATE INDEX "ix_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "ix_adjustment_run" ON "payroll_adjustment" USING btree ("run_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_payroll_job" ON "payroll_job" USING btree ("run_id","employee_id");--> statement-breakpoint
CREATE INDEX "ix_payroll_job_claim" ON "payroll_job" USING btree ("run_id","shard","id") WHERE "payroll_job"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "ix_payroll_line_run_emp" ON "payroll_line" USING btree ("run_id","employee_id","sort_order");--> statement-breakpoint
CREATE INDEX "ix_payroll_line_code" ON "payroll_line" USING btree ("run_id","code");--> statement-breakpoint
CREATE INDEX "ix_payroll_period_range" ON "payroll_period" USING btree ("date_from","date_to");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_payroll_run" ON "payroll_run" USING btree ("period_id","run_no");--> statement-breakpoint
CREATE INDEX "ix_payroll_run_status" ON "payroll_run" USING btree ("status") WHERE "payroll_run"."status" <> 'POSTED';--> statement-breakpoint
CREATE INDEX "ix_run_item_employee" ON "payroll_run_item" USING btree ("employee_id","run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_payslip_revision" ON "payslip_revision" USING btree ("run_id","employee_id","revision");