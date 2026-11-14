CREATE TABLE "task_change_request" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text,
	"workspace_id" text NOT NULL,
	"project_id" text,
	"task_key" text NOT NULL,
	"task_title" text NOT NULL,
	"requested_by" text,
	"channel" text,
	"auth_method" text,
	"api_key_id" text,
	"kind" text NOT NULL,
	"target_status" text,
	"base_status" text NOT NULL,
	"base_generation" integer NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_channel" text,
	"decided_at" timestamp,
	"reason" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "status_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task_change_request" ADD CONSTRAINT "task_change_request_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_change_request" ADD CONSTRAINT "task_change_request_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_change_request" ADD CONSTRAINT "task_change_request_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_change_request" ADD CONSTRAINT "task_change_request_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_change_request" ADD CONSTRAINT "task_change_request_api_key_id_apikey_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."apikey"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_change_request" ADD CONSTRAINT "task_change_request_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "task_change_request_one_pending_idx" ON "task_change_request" USING btree ("task_id") WHERE "task_change_request"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "task_change_request_due_idx" ON "task_change_request" USING btree ("expires_at") WHERE "task_change_request"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "task_change_request_workspace_created_idx" ON "task_change_request" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "task_change_request_requested_by_idx" ON "task_change_request" USING btree ("requested_by","created_at");--> statement-breakpoint
CREATE INDEX "task_change_request_task_idx" ON "task_change_request" USING btree ("task_id");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_createdBy_idx" ON "task" USING btree ("created_by");--> statement-breakpoint
-- Backfill the creator from history: the earliest "created" activity with a
-- known user within 5 minutes of the task's creation. Anything else stays null.
UPDATE "task" AS "t"
SET "created_by" = "c"."user_id"
FROM (
	SELECT DISTINCT ON ("a"."task_id") "a"."task_id", "a"."user_id"
	FROM "activity" AS "a"
	JOIN "task" AS "t2" ON "t2"."id" = "a"."task_id"
	WHERE "a"."type" = 'created'
		AND "a"."user_id" IS NOT NULL
		AND "a"."created_at" BETWEEN "t2"."created_at" - interval '5 minutes' AND "t2"."created_at" + interval '5 minutes'
	ORDER BY "a"."task_id", "a"."created_at", "a"."id"
) AS "c"
WHERE "t"."id" = "c"."task_id" AND "t"."created_by" IS NULL;
