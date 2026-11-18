CREATE TABLE "workspace_join_link" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_ciphertext" text,
	"role" text DEFAULT 'member' NOT NULL,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"revoked_at" timestamp,
	"revoked_by" text,
	CONSTRAINT "workspace_join_link_role_check" CHECK ("workspace_join_link"."role" = 'member'),
	CONSTRAINT "workspace_join_link_max_uses_check" CHECK ("workspace_join_link"."max_uses" is null or "workspace_join_link"."max_uses" >= 1),
	CONSTRAINT "workspace_join_link_use_count_check" CHECK ("workspace_join_link"."use_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_member_removal" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"removed_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "workspace_member_removal_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_join_link" ADD CONSTRAINT "workspace_join_link_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_join_link" ADD CONSTRAINT "workspace_join_link_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_join_link" ADD CONSTRAINT "workspace_join_link_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member_removal" ADD CONSTRAINT "workspace_member_removal_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_member_removal" ADD CONSTRAINT "workspace_member_removal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_join_link_tokenHash_uidx" ON "workspace_join_link" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_join_link_one_open_uidx" ON "workspace_join_link" USING btree ("workspace_id") WHERE "workspace_join_link"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "workspace_join_link_workspaceId_createdAt_idx" ON "workspace_join_link" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "workspace_join_link_createdBy_idx" ON "workspace_join_link" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "workspace_join_link_revokedBy_idx" ON "workspace_join_link" USING btree ("revoked_by");--> statement-breakpoint
CREATE INDEX "workspace_member_removal_userId_idx" ON "workspace_member_removal" USING btree ("user_id");--> statement-breakpoint
-- Join links replace email invites: an emailed link can no longer be accepted.
UPDATE "invitation" SET "status" = 'canceled' WHERE "status" = 'pending';
