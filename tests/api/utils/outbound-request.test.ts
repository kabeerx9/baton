import { createServer, type Server } from "node:http";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  safeOutboundError,
  sendOutboundRequest,
} from "../../../apps/api/src/utils/outbound-request";

let server: Server;
let base: string;
let redirected = 0;
let receivedSignature: string | string[] | undefined;
let receivedBody = "";
beforeEach(async () => {
  redirected = 0;
  receivedSignature = undefined;
  receivedBody = "";
  server = createServer((request, response) => {
    if (request.url === "/signed") {
      receivedSignature = request.headers["x-baton-signature"];
      request.on("data", (chunk) => {
        receivedBody += chunk.toString();
      });
      request.on("end", () => response.end());
      return;
    }
    if (request.url === "/hang") return;
    if (request.url === "/redirect") {
      response.writeHead(307, { Location: `${base}/target` });
      response.end();
      return;
    }
    if (request.url === "/target") redirected++;
    if (request.url === "/slow-json") {
      response.writeHead(200);
      response.write('{"ok":');
      return;
    }
    if (request.url === "/error") {
      response.writeHead(500);
      response.write("secret echoed by server");
      return;
    }
    if (request.url === "/big-json") {
      response.end(JSON.stringify({ ok: true, data: "x".repeat(32_768) }));
      return;
    }
    response.end('{"ok":true}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test port");
  base = `http://127.0.0.1:${address.port}`;
  vi.stubEnv("BATON_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("outbound notification transport", () => {
  it("accepts success and sends the payload and headers unchanged", async () => {
    await expect(
      sendOutboundRequest(
        `${base}/signed`,
        {
          headers: { "X-Baton-Signature": "sig" },
          body: JSON.stringify({ title: "test" }),
        },
        { publicDestination: true },
      ),
    ).resolves.toBeUndefined();
    expect(receivedBody).toBe(JSON.stringify({ title: "test" }));
    expect(receivedSignature).toBe("sig");
    await expect(
      sendOutboundRequest(`${base}/ok`, {}, { readJson: true }),
    ).resolves.toEqual({
      ok: true,
    });
  });
  it("refuses a redirect without sending any payload to its target", async () => {
    await expect(
      sendOutboundRequest(`${base}/redirect`, {
        body: "private",
        headers: { Authorization: "Bearer secret" },
      }),
    ).rejects.toMatchObject({ reason: "http", status: 307 });
    expect(redirected).toBe(0);
  });
  it("rejects private destinations by default before fetching", async () => {
    vi.stubEnv("BATON_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "false");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      sendOutboundRequest(`${base}/ok`, {}, { publicDestination: true }),
    ).rejects.toMatchObject({
      reason: "destination",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it.each(["/hang", "/slow-json"])(
    "times out both headers and body reads: %s",
    async (path) => {
      await expect(
        sendOutboundRequest(
          `${base}${path}`,
          {},
          { readJson: true, timeoutMs: 80 },
        ),
      ).rejects.toMatchObject({ reason: "timeout" });
    },
  );
  it("ignores an error body even when the peer never finishes it", async () => {
    await expect(
      sendOutboundRequest(`${base}/error`, {}, { timeoutMs: 500 }),
    ).rejects.toMatchObject({
      reason: "http",
      status: 500,
      message: "Outbound request failed: http (HTTP 500)",
    });
  });
  it("caps JSON response size", async () => {
    await expect(
      sendOutboundRequest(`${base}/big-json`, {}, { readJson: true }),
    ).rejects.toMatchObject({ reason: "response" });
  });
  it("drops credential-bearing fetch errors, causes and URLs", async () => {
    const secret = "private-bot-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(
        new Error(`Cannot reach https://api.example.com/bot${secret}`, {
          cause: { token: secret },
        }),
      ),
    );
    try {
      await sendOutboundRequest(`https://api.example.com/bot${secret}`, {
        body: "private",
      });
      expect.fail("Request should fail");
    } catch (error) {
      expect(error).toMatchObject({ reason: "network" });
      expect(error).not.toHaveProperty("cause");
      expect(String(error)).not.toContain(secret);
      expect(safeOutboundError(error)).toBe("Outbound request failed: network");
    }
    expect(safeOutboundError(new Error(secret))).not.toContain(secret);
  });
});
