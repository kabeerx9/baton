ALTER TABLE "account" ADD COLUMN "credential_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Every password change bumps the generation in the same row write, whatever
-- path makes it (self-service reset, change-password, admin set-user-password).
-- An MCP authorization code stores the generation seen at consent and is
-- refused when it no longer matches, so ordering never depends on clocks.
CREATE FUNCTION bump_credential_generation() RETURNS trigger AS $$
BEGIN
  NEW.credential_generation := OLD.credential_generation + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER account_credential_generation BEFORE UPDATE OF password ON account
  FOR EACH ROW WHEN (NEW.password IS DISTINCT FROM OLD.password)
  EXECUTE FUNCTION bump_credential_generation();
