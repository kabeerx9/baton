import { describe, expect, it } from "vite-plus/test";
import { parseTokenRequest } from "./parse-token-request";

const verifier = "a".repeat(43);
const code = {
  grant_type: "authorization_code",
  code: "c",
  client_id: "client",
  code_verifier: verifier,
  redirect_uri: "http://127.0.0.1/cb",
};

describe("parseTokenRequest", () => {
  it("parses both grants", () => {
    expect(parseTokenRequest(code).kind).toBe("authorization_code");
    expect(
      parseTokenRequest({
        grant_type: "refresh_token",
        refresh_token: "r",
        client_id: "client",
      }),
    ).toEqual({ kind: "refresh_token", refreshToken: "r", clientId: "client" });
  });

  it.each([
    ["too short", "a".repeat(42)],
    ["too long", "a".repeat(129)],
    ["reserved characters", `${"a".repeat(42)}+`],
    ["spaces", `${"a".repeat(42)} `],
  ])("rejects a verifier with %s", (_label, code_verifier) => {
    expect(parseTokenRequest({ ...code, code_verifier })).toEqual({
      kind: "error",
      error: "invalid_request",
    });
  });

  it("accepts every unreserved character in a verifier", () => {
    const code_verifier = `${"A".repeat(36)}az09-._~`;
    expect(parseTokenRequest({ ...code, code_verifier }).kind).toBe(
      "authorization_code",
    );
  });

  it("checks resource and grant type", () => {
    expect(
      parseTokenRequest({ ...code, resource: "https://evil.example/api/mcp" }),
    ).toEqual({ kind: "error", error: "invalid_target" });
    expect(
      parseTokenRequest({ ...code, resource: "http://localhost:1337/api/mcp" })
        .kind,
    ).toBe("authorization_code");
    expect(parseTokenRequest({ ...code, grant_type: "password" })).toEqual({
      kind: "error",
      error: "unsupported_grant_type",
    });
  });
});
