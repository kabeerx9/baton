CREATE TABLE "slack_user_link" (
	"user_id" text PRIMARY KEY NOT NULL,
	"slack_user_id" text,
	"source" text DEFAULT 'email' NOT NULL,
	"checked_at" timestamp,
	"last_digest_day" text
);
--> statement-breakpoint
ALTER TABLE "slack_user_link" ADD CONSTRAINT "slack_user_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;