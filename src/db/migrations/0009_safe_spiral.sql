ALTER TYPE "public"."user_role" ADD VALUE 'OWNER' BEFORE 'ADMIN';--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "photo" text;