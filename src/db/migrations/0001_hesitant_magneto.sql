CREATE TABLE IF NOT EXISTS "bundy_ip" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bundy_ip_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"ip" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundy_ip_ip_unique" UNIQUE("ip")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_template" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shift_template_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text NOT NULL,
	"break1_start" text,
	"break1_end" text,
	"lunch_start" text NOT NULL,
	"lunch_end" text NOT NULL,
	"break2_start" text,
	"break2_end" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_template_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_compensation_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_compensation_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"employee_id" bigint NOT NULL,
	"base_salary_monthly" bigint NOT NULL,
	"pay_frequency" "pay_frequency" NOT NULL,
	"effective_from" date NOT NULL,
	"reason" text NOT NULL,
	"changed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_day" ADD COLUMN IF NOT EXISTS "break1_out_utc" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_day" ADD COLUMN IF NOT EXISTS "break1_in_utc" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_day" ADD COLUMN IF NOT EXISTS "lunch_out_utc" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_day" ADD COLUMN IF NOT EXISTS "lunch_in_utc" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_day" ADD COLUMN IF NOT EXISTS "break2_out_utc" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_day" ADD COLUMN IF NOT EXISTS "break2_in_utc" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "bundy_pin" text;--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "shift_template_id" bigint;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "employee_compensation_history" ADD CONSTRAINT "employee_compensation_history_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "employee_compensation_history" ADD CONSTRAINT "employee_compensation_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_comp_history" ON "employee_compensation_history" USING btree ("employee_id","effective_from");--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "employee" ADD CONSTRAINT "employee_shift_template_id_shift_template_id_fk" FOREIGN KEY ("shift_template_id") REFERENCES "public"."shift_template"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
INSERT INTO "employee_compensation_history" ("employee_id", "base_salary_monthly", "pay_frequency", "effective_from", "reason")
SELECT "id", "base_salary_monthly", "pay_frequency", "date_hired", 'HIRE'
FROM "employee"
WHERE NOT EXISTS (
	SELECT 1 FROM "employee_compensation_history" "h" WHERE "h"."employee_id" = "employee"."id"
);
