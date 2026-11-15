import { describe, expect, it } from "vite-plus/test";
import { classifyUrl, instanceFor } from "./instance";

describe("classifyUrl", () => {
  it.each([
    ["https://baton.wicketry.dev/api/mcp", "https"],
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

describe("instanceFor", () => {
  it("gives each scenario a classified url", () => {
    expect(instanceFor("normal").kind).toBe("https");
    expect(instanceFor("localhost").kind).toBe("loopback");
    expect(instanceFor("lan").kind).toBe("http-remote");
  });
});
