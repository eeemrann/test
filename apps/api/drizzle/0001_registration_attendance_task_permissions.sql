CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."attendance_check_in_status" AS ENUM('PRESENT', 'LATE');--> statement-breakpoint
CREATE TYPE "public"."registration_action" AS ENUM('SUBMITTED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"check_in_at" timestamp with time zone NOT NULL,
	"check_out_at" timestamp with time zone,
	"check_in_status" "attendance_check_in_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" "registration_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approval_status" "approval_status" DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "attendance_eligible_from" timestamp with time zone;--> statement-breakpoint
UPDATE "users"
SET
	"approved_at" = COALESCE("approved_at", CURRENT_TIMESTAMP),
	"attendance_eligible_from" = COALESCE("attendance_eligible_from", CURRENT_TIMESTAMP)
WHERE "approval_status" = 'APPROVED';--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "registration_audits" ADD CONSTRAINT "registration_audits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "registration_audits" ADD CONSTRAINT "registration_audits_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_user_date_unique" ON "attendance" USING btree ("user_id","attendance_date");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" USING btree ("attendance_date");--> statement-breakpoint
CREATE INDEX "attendance_user_date_idx" ON "attendance" USING btree ("user_id","attendance_date");--> statement-breakpoint
CREATE INDEX "registration_audits_user_id_idx" ON "registration_audits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "registration_audits_created_at_idx" ON "registration_audits" USING btree ("created_at");
