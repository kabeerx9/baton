DROP TABLE "team_member", "team", "invitation";--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "active_organization_id", DROP COLUMN "active_team_id", DROP COLUMN "impersonated_by";
