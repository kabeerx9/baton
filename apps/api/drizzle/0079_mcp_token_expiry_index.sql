DROP INDEX "mcp_token_grantId_idx";--> statement-breakpoint
CREATE INDEX "mcp_token_grantId_expiresAt_idx" ON "mcp_token" USING btree ("grant_id","expires_at");