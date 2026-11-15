import { describe, expect, it } from "vite-plus/test";
import { redirectUriMatches } from "./redirect-uri-matches";

describe("redirectUriMatches", () => {
  it.each([
    ["http://127.0.0.1:3000/callback", "http://127.0.0.1:53682/callback"],
    ["http://localhost/callback", "http://localhost:4000/callback"],
    ["http://[::1]:1/cb?x=1", "http://[::1]:2/cb?x=1"],
    ["https://client.example/cb", "https://client.example/cb"],
  ])("accepts %s for %s", (registered, requested) => {
    expect(redirectUriMatches(registered, requested)).toBe(true);
  });

  it.each([
    ["http://127.0.0.1:3000/callback", "http://127.0.0.1:3000/other"],
    ["http://127.0.0.1:3000/callback", "http://localhost:3000/callback"],
    ["https://client.example:443/cb", "https://client.example:8443/cb"],
    ["http://127.0.0.1:3000/cb", "https://127.0.0.1:3000/cb"],
    ["cursor://cb", "cursor://other"],
  ])("refuses %s for %s", (registered, requested) => {
    expect(redirectUriMatches(registered, requested)).toBe(false);
  });
});
