import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { classifyUrl, mcpInstance } from "./instance";

describe("classifyUrl", () => {
  it.each([
    ["https://baton.example.com/api/mcp", "https"],
    ["http://localhost:1337/api/mcp", "loopback"],
    ["http://127.0.0.1:1337/api/mcp", "loopback"],
    ["http://[::1]:1337/api/mcp", "loopback"],
    ["http://192.168.1.24:1337/api/mcp", "http-remote"],
    ["http://baton.internal/api/mcp", "http-remote"],
    ["not a url", "http-remote"],
  ])("%s is %s", (url, kind) => {
    expect(classifyUrl(url)).toBe(kind);
  });
});

describe("mcpInstance", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the separately hosted API origin", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    expect(mcpInstance("https://app.example.com")).toEqual({
      url: "https://api.example.com/api/mcp",
      kind: "https",
    });
  });

  it("does not double /api", () => {
    vi.stubEnv("VITE_API_URL", "https://baton.example.com/api/");
    expect(mcpInstance("https://baton.example.com").url).toBe(
      "https://baton.example.com/api/mcp",
    );
  });

  it("resolves a relative API address against the page origin", () => {
    vi.stubEnv("VITE_API_URL", "/api");
    expect(mcpInstance("http://192.168.1.24:1337")).toEqual({
      url: "http://192.168.1.24:1337/api/mcp",
      kind: "http-remote",
    });
  });

  it("marks a localhost API as loopback", () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:1337");
    expect(mcpInstance("http://localhost:5173").kind).toBe("loopback");
  });
});
