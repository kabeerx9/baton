import type { InstanceKind } from "./instance";
import type { ClientId } from "./types";

export type SetupCode = {
  /** File to edit, shown above the code. Absent for shell commands. */
  path?: string;
  text: string;
};

export type SetupStep = {
  /** Names the copy: `settings:connectAgent.setup.<client>.<id>.title` and `.body`. */
  id: string;
  /** True when the step has a sentence under the title. */
  hasBody: boolean;
  code?: SetupCode;
  /** Link to the API keys page, for steps that need a key. */
  keysLink?: boolean;
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** The exact one-time setup for a client, with the real instance URL filled in. */
export function buildSetup(
  client: ClientId,
  url: string,
  kind: InstanceKind,
): SetupStep[] {
  switch (client) {
    case "claude-code":
      return [
        {
          id: "add",
          hasBody: false,
          code: {
            text: `claude mcp add --transport http --scope user baton ${url}`,
          },
        },
        { id: "signIn", hasBody: true, code: { text: "/mcp" } },
      ];
    case "codex":
      return [
        {
          id: "add",
          hasBody: false,
          code: { text: `codex mcp add baton --url ${url}` },
        },
        {
          id: "signIn",
          hasBody: true,
          code: { text: "codex mcp login baton" },
        },
      ];
    case "opencode":
      return [
        {
          id: "add",
          hasBody: false,
          code: {
            path: "opencode.json",
            text: json({ mcp: { baton: { type: "remote", url } } }),
          },
        },
        {
          id: "signIn",
          hasBody: true,
          code: { text: "opencode mcp auth baton" },
        },
      ];
    case "cursor":
      return [
        {
          id: "add",
          hasBody: false,
          code: {
            path: "~/.cursor/mcp.json",
            text: json({ mcpServers: { baton: { url } } }),
          },
        },
        { id: "signIn", hasBody: true },
      ];
    case "claude-desktop":
      // The connector needs a public https address. Anything else uses a key.
      if (kind === "https") {
        return [
          { id: "connector", hasBody: true },
          { id: "signIn", hasBody: true },
        ];
      }
      return [
        { id: "key", hasBody: true, keysLink: true },
        { id: "bridge", hasBody: true },
      ];
    case "headless":
      return [
        {
          id: "header",
          hasBody: true,
          code: { text: "Authorization: Bearer <API key>" },
          keysLink: true,
        },
      ];
  }
}
