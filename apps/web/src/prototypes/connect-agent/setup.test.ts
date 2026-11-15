import { describe, expect, it } from "vite-plus/test";
import { buildSetup } from "./setup";

const URL_ = "https://baton.wicketry.dev/api/mcp";

describe("buildSetup", () => {
  it("prints the exact Claude Code command with the instance url", () => {
    const [add] = buildSetup("claude-code", URL_, "https");
    expect(add?.code?.text).toBe(
      "claude mcp add --transport http --scope user baton https://baton.wicketry.dev/api/mcp",
    );
  });

  it("prints the exact Codex commands", () => {
    const steps = buildSetup("codex", URL_, "https");
    expect(steps[0]?.code?.text).toBe(`codex mcp add baton --url ${URL_}`);
    expect(steps[1]?.code?.text).toBe("codex mcp login baton");
  });

  it("writes valid config JSON for OpenCode and Cursor", () => {
    const opencode = buildSetup("opencode", URL_, "https")[0]?.code?.text ?? "";
    expect(JSON.parse(opencode)).toEqual({
      mcp: { baton: { type: "remote", url: URL_ } },
    });
    const cursor = buildSetup("cursor", URL_, "https")[0]?.code?.text ?? "";
    expect(JSON.parse(cursor)).toEqual({
      mcpServers: { baton: { url: URL_ } },
    });
  });

  it("offers the connector only on public https", () => {
    expect(buildSetup("claude-desktop", URL_, "https")[0]?.title).toBe(
      "Add a custom connector",
    );
    const local = buildSetup(
      "claude-desktop",
      "http://localhost:1337/api/mcp",
      "loopback",
    );
    expect(local[0]?.keysLink).toBe(true);
    expect(local.some((step) => step.title === "Add a custom connector")).toBe(
      false,
    );
  });

  it("uses the bearer header for headless", () => {
    expect(buildSetup("headless", URL_, "https")[0]?.code?.text).toBe(
      "Authorization: Bearer <API key>",
    );
  });
});
