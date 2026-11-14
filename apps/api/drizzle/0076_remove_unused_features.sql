DROP TABLE "billing_event" CASCADE;--> statement-breakpoint
DROP TABLE "billing_reminder_sent" CASCADE;--> statement-breakpoint
DROP TABLE "calendar_feed" CASCADE;--> statement-breakpoint
DROP TABLE "custom_field_definition" CASCADE;--> statement-breakpoint
DROP TABLE "custom_field_value" CASCADE;--> statement-breakpoint
DROP TABLE "device_code" CASCADE;--> statement-breakpoint
DROP TABLE "import_run" CASCADE;--> statement-breakpoint
DROP TABLE "time_entry" CASCADE;--> statement-breakpoint
DROP TABLE "trial_grant" CASCADE;--> statement-breakpoint
DROP TABLE "workspace_billing" CASCADE;--> statement-breakpoint
DROP INDEX "session_oidcSid_idx";--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "is_public";--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "oidc_sid";--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "recurrence";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "locale";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "is_anonymous";
