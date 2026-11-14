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
import { timeOutRequest } from "../../apps/api/src/task-change-request/expire-change-requests";
import {
  answer,
  changeRequestFixture,
  createKey,
  makeDue,
  readRequest,
  readTask,
  requestStatus,
  withKey,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";

// B4 and B5: accept and the timeout re-check the workspace and the
// credential the request was made with, not only the account.

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

/** Opens a status request with an API key of the outsider. */
async function requestWithKey(
  f: Awaited<ReturnType<typeof changeRequestFixture>>,
) {
  const key = await createKey(f.outsider.id);
  const response = await withKey(key.key)(`/api/task/status/${f.task.id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "in-progress" }),
  });
  expect(response.status).toBe(202);
  const requestId = (await response.json()).request.id as string;
  expect(await readRequest(requestId)).toMatchObject({
    authMethod: "api_key",
    apiKeyId: key.id,
  });
  return { requestId, keyId: key.id };
}

function updateKey(
  keyId: string,
  values: Partial<typeof schema.apikeyTable.$inferInsert>,
) {
  return db
    .update(schema.apikeyTable)
    .set(values)
    .where(eq(schema.apikeyTable.id, keyId));
}

async function expectCancelled(requestId: string, reason: string) {
  expect(await readRequest(requestId)).toMatchObject({
    state: "cancelled",
    reason,
  });
}

describe("archived workspace", () => {
  it("cancels a due request in an archived workspace instead of applying it", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    await db
      .update(schema.workspaceTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.workspaceTable.id, f.workspace.id));
    await makeDue(requestId);

    expect(await timeOutRequest(requestId)).toBe("cancelled");
    await expectCancelled(requestId, "workspace_archived");
    expect((await readTask(f.task.id))?.status).toBe("to-do");
  });
});

describe("originating API key", () => {
  it("stores no key for a session request and still applies it", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    expect(await readRequest(requestId)).toMatchObject({
      authMethod: "cookie",
      apiKeyId: null,
    });
    expect((await answer(f.creator, requestId, "accept")).status).toBe(200);
    expect((await readRequest(requestId))?.state).toBe("accepted");
  });

  it("cancels on accept after the key is disabled", async () => {
    const f = await changeRequestFixture();
    const { requestId, keyId } = await requestWithKey(f);
    await updateKey(keyId, { enabled: false });

    expect((await answer(f.creator, requestId, "accept")).status).toBe(200);
    await expectCancelled(requestId, "credential_revoked");
    expect((await readTask(f.task.id))?.status).toBe("to-do");
  });

  it("cancels on timeout after the key scope is narrowed", async () => {
    const f = await changeRequestFixture();
    const { requestId, keyId } = await requestWithKey(f);
    await updateKey(keyId, {
      permissions: JSON.stringify({ task: ["read"] }),
    });
    await makeDue(requestId);

    expect(await timeOutRequest(requestId)).toBe("cancelled");
    await expectCancelled(requestId, "credential_revoked");
    expect((await readTask(f.task.id))?.status).toBe("to-do");
  });

  it("cancels on timeout after the key expired or was deleted", async () => {
    const f = await changeRequestFixture();
    const expired = await requestWithKey(f);
    await updateKey(expired.keyId, { expiresAt: new Date(Date.now() - 1000) });
    await makeDue(expired.requestId);
    expect(await timeOutRequest(expired.requestId)).toBe("cancelled");
    await expectCancelled(expired.requestId, "credential_revoked");

    const deleted = await requestWithKey(f);
    await db
      .delete(schema.apikeyTable)
      .where(eq(schema.apikeyTable.id, deleted.keyId));
    expect((await readRequest(deleted.requestId))?.apiKeyId).toBeNull();
    await makeDue(deleted.requestId);
    expect(await timeOutRequest(deleted.requestId)).toBe("cancelled");
    await expectCancelled(deleted.requestId, "credential_revoked");
  });
});
