ALTER TABLE "user" ADD COLUMN "tour_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "kind" text DEFAULT 'team' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "demo_owner_user_id" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_demo_owner_user_id_user_id_fk" FOREIGN KEY ("demo_owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_one_demo_per_user_idx" ON "workspace" USING btree ("demo_owner_user_id") WHERE "workspace"."kind" = 'demo';--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_kind_check" CHECK ("workspace"."kind" in ('team', 'demo'));--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_demo_owner_check" CHECK (("workspace"."kind" = 'demo') = ("workspace"."demo_owner_user_id" is not null));--> statement-breakpoint
-- People who signed up before the tour existed already know Baton: mark it done.
UPDATE "user" SET "tour_completed_at" = (now() AT TIME ZONE 'utc') WHERE "tour_completed_at" IS NULL;
