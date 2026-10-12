CREATE TYPE "public"."leave_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "leave_request" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_request_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"employee_id" bigint NOT NULL,
	"leave_type_id" bigint NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"days" numeric(5, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" "leave_status" DEFAULT 'PENDING' NOT NULL,
	"filed_by" text NOT NULL,
	"filed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text
);
--> statement-breakpoint
CREATE TABLE "leave_type" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_type_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"annual_days" numeric(5, 2) DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "leave_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "attendance_day" ADD COLUMN "leave_request_id" bigint;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_leave_type_id_leave_type_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_filed_by_users_id_fk" FOREIGN KEY ("filed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_leave_request_employee" ON "leave_request" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "ix_leave_request_status" ON "leave_request" USING btree ("status");--> statement-breakpoint
ALTER TABLE "attendance_day" ADD CONSTRAINT "attendance_day_leave_request_id_leave_request_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "leave_type" ("code", "name", "is_paid", "annual_days") VALUES ('VL', 'Vacation Leave', true, 5), ('SL', 'Sick Leave', true, 5) ON CONFLICT ("code") DO NOTHING;