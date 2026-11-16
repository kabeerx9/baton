import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { listMcpGrants } from "./list-grants";
import { revokeMcpGrant } from "./revoke-grant";

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("listMcpGrants", () => {
  it("asks for a page with the session cookie and returns it", async () => {
    const page = { grants: [], nextCursor: "abc" };
    fetchMock.mockResolvedValue(json(page));

    await expect(listMcpGrants()).resolves.toEqual(page);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toMatch(/\/api\/mcp\/grants\?limit=20$/);
    expect(init).toMatchObject({ credentials: "include" });
  });

  it("sends the cursor for the next page", async () => {
    fetchMock.mockResolvedValue(json({ grants: [], nextCursor: null }));
    await listMcpGrants("a b");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("cursor=a+b");
  });

  it("throws an HttpError with the status when the API refuses", async () => {
    fetchMock.mockResolvedValue(json({ message: "Forbidden" }, 403));
    await expect(listMcpGrants()).rejects.toMatchObject({
      name: "HttpError",
      status: 403,
    });
  });
});

describe("revokeMcpGrant", () => {
  it("sends DELETE for the grant id", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await revokeMcpGrant("g/1");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toMatch(/\/api\/mcp\/grants\/g%2F1$/);
    expect(init).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("treats 404 as already gone", async () => {
    fetchMock.mockResolvedValue(json({ message: "Grant not found" }, 404));
    await expect(revokeMcpGrant("g1")).resolves.toBeUndefined();
  });

  it.each([401, 403, 500])("throws on %s", async (status) => {
    fetchMock.mockResolvedValue(json({ message: "no" }, status));
    const error = await revokeMcpGrant("g1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status });
  });
});
