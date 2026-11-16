CREATE TABLE "mcp_grant" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"resource" text NOT NULL,
	"default_workspace_id" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"last_used_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"idle_expires_at" timestamp NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mcp_token" (
	"id" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"rotated_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_grant" ADD CONSTRAINT "mcp_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_grant" ADD CONSTRAINT "mcp_grant_default_workspace_id_workspace_id_fk" FOREIGN KEY ("default_workspace_id") REFERENCES "public"."workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_token" ADD CONSTRAINT "mcp_token_grant_id_mcp_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."mcp_grant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_grant_userId_idx" ON "mcp_grant" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_token_tokenHash_uidx" ON "mcp_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mcp_token_grantId_idx" ON "mcp_token" USING btree ("grant_id");