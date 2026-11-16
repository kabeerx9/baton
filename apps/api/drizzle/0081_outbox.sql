CREATE TABLE "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"type" text NOT NULL,
	"consumer" text NOT NULL,
	"payload" jsonb NOT NULL,
	"initiator_id" text,
	"channel" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT (statement_timestamp() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_due_idx" ON "outbox" USING btree ("next_attempt_at","id") WHERE "outbox"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "outbox_workspace_idx" ON "outbox" USING btree ("workspace_id");