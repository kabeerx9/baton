import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { adminWithTarget } from "./helpers/admin/admin-users-api";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import {
  avatarState,
  deferred,
  expectAvatarInSync,
  injectFailure,
  settlesWithin,
} from "./helpers/avatar/avatar-state";
import { resetTestDatabase } from "./helpers/database";
import { decodeAvatarUpload } from "../../apps/api/src/user/avatar";
import { replaceUserAvatar } from "../../apps/api/src/user/avatar-store/replace-user-avatar";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]).toString("base64");

let setup: Awaited<ReturnType<typeof adminWithTarget>>;

beforeEach(async () => {
  await resetTestDatabase();
  setup = await adminWithTarget();
});
afterEach(() => vi.unstubAllEnvs());

const avatar = (method: string, body?: unknown) =>
  setup.asAdmin(`/${setup.target.userId}/avatar`, { method, body });
const upload = () => avatar("PUT", { contentType: "image/png", data: PNG });

async function targetImage() {
  const [user] = await db
    .select({ image: schema.userTable.image })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, setup.target.userId));
  return user?.image;
}

describe("admin avatar management", () => {
  it("sets and removes another user's avatar, recording each once", async () => {
    const set = await upload();
    expect(set.status, await set.clone().text()).toBe(200);
    const { image } = (await set.json()) as { image: string };
    expect(image).toMatch(/^\/api\/user\/avatar\//);
    expect(await targetImage()).toBe(image);
    const served = await setup.app.request(image);
    expect(served.status).toBe(200);

    const removed = await avatar("DELETE");
    expect(await removed.json()).toEqual({ removed: true });
    expect(await targetImage()).toBeNull();
    expect(await db.select().from(schema.userAvatarTable)).toEqual([]);

    const again = await avatar("DELETE");
    expect(await again.json()).toEqual({ removed: false });

    const rows = await readAuditLog();
    expect(rows.map((row) => row.action)).toEqual([
      "user.avatar_changed",
      "user.avatar_removed",
    ]);
    expect(rows.every((row) => row.targetId === setup.target.userId)).toBe(
      true,
    );
    expect(JSON.stringify(rows)).not.toContain(PNG);
  });

  it("rejects images that are not what they claim", async () => {
    const response = await avatar("PUT", {
      contentType: "image/jpeg",
      data: PNG,
    });
    expect(response.status).toBe(400);
    expect(await targetImage()).toBeNull();
    expect(await readAuditLog()).toEqual([]);
  });

  it("rolls back the picture when the audit entry fails", async () => {
    const before = (await (await upload()).json()) as { image: string };
    const stateBefore = await avatarState(setup.target.userId);
    expect(stateBefore.image).toBe(before.image);

    const restore = await injectFailure("admin_audit_log", "BEFORE INSERT");
    try {
      expect((await upload()).status).toBe(500);
      expect((await avatar("DELETE")).status).toBe(500);
    } finally {
      await restore();
    }
    expect(await avatarState(setup.target.userId)).toEqual(stateBefore);
    expect(await readAuditLog()).toHaveLength(1);
  });

  it("returns 404 for a missing user", async () => {
    const response = await setup.asAdmin("/missing-user/avatar", {
      method: "PUT",
      body: { contentType: "image/png", data: PNG },
    });
    expect(response.status).toBe(404);
  });

  it("waits for the user's own upload in flight, then removes it", async () => {
    const held = deferred();
    const locked = deferred();
    const holder = db.transaction(async (tx) => {
      await replaceUserAvatar(
        tx,
        setup.target.userId,
        decodeAvatarUpload({ contentType: "image/png", data: PNG }),
      );
      locked.resolve();
      await held.promise;
    });
    await locked.promise;

    const removal = avatar("DELETE");
    try {
      expect(await settlesWithin(removal)).toBe("pending");
    } finally {
      held.resolve();
      await holder;
    }
    expect(await (await removal).json()).toEqual({ removed: true });
    expect(await expectAvatarInSync(setup.target.userId)).toEqual({
      image: null,
      rowIds: [],
    });
  });
});
