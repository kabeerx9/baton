import { beforeEach, describe, expect, it } from "vite-plus/test";
import { resetJoinLinkRateLimits } from "../../apps/api/src/join-link/rate-limit";
import { resetTestDatabase } from "./helpers/database";
import { joinLinkFixture, memberRows } from "./helpers/join-link";

// People paste what they copied: the token with spaces around it, or the
// whole join URL. The API reads the token out of both, as the web field does.

beforeEach(async () => {
  await resetTestDatabase();
  resetJoinLinkRateLimits();
});

function pastedForms(token: string) {
  return {
    spaces: `  ${token}  `,
    newline: `${token}\n`,
    url: `http://localhost:5173/join/${token}`,
    urlWithSpaces: ` https://baton.example/join/${token}/ `,
    path: `/join/${token}`,
    query: `https://baton.example/join?t=${token}`,
  };
}

describe("join link token as pasted", () => {
  it("previews every pasted form as the active link", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    for (const [name, pasted] of Object.entries(pastedForms(token))) {
      const response = await ctx.preview(pasted);
      expect(response.status, name).toBe(200);
      expect(((await response.json()) as { status: string }).status, name).toBe(
        "active",
      );
    }
  });

  it("joins with every pasted form", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    for (const [name, pasted] of Object.entries(pastedForms(token))) {
      const who = await ctx.person(`Joiner ${name}`);
      const response = await ctx.join(who, pasted);
      expect(response.status, name).toBe(200);
      expect(await memberRows(ctx.workspace.id, who.userId), name).toHaveLength(
        1,
      );
    }
  });

  it("still answers not found for garbage and near misses", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const who = await ctx.person("Guesser");
    for (const pasted of [
      "garbage",
      "   ",
      `${token}x`,
      `https://baton.example/join/${token}x`,
      `https://baton.example/other/${token}`,
      `https://baton.example/join/${token}/extra`,
      `https://baton.example/join?t=${token}x`,
      `${token} ${token}`,
      // Malformed URLs: once a 500, now the same not found.
      "//[",
      "https://[",
    ]) {
      const joined = await ctx.join(who, pasted);
      expect(joined.status, pasted).toBe(404);
      expect(((await joined.json()) as { code: string }).code, pasted).toBe(
        "JOIN_LINK_NOT_FOUND",
      );
      const preview = await ctx.preview(pasted);
      expect(preview.status, pasted).toBe(200);
      expect(
        ((await preview.json()) as { status: string }).status,
        pasted,
      ).toBe("unavailable");
    }
    expect(await memberRows(ctx.workspace.id, who.userId)).toHaveLength(0);
  });
});
