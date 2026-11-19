-- The built-in viewer now works on tasks assigned to them
-- (task:update_assigned). Rewrite every stored viewer role to the new
-- default payload: older rows may still carry "team":[] or a hand edit.
-- Matches on the reserved role name, never on the old payload.
UPDATE "workspace_role"
SET
  "permission" = '{"organization":[],"member":[],"invitation":[],"ac":["read"],"project":["read"],"task":["read","update_assigned"],"label":["read"],"workspace":["read"]}',
  "updated_at" = now() AT TIME ZONE 'utc'
WHERE "role" = 'viewer';
