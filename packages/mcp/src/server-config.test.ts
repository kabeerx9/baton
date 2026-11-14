import { describe, expect, it } from "vite-plus/test";
import {
  MISSING_API_KEY_MESSAGE,
  MissingApiKeyError,
  readServerConfig,
} from "./server-config.js";

describe("readServerConfig", () => {
  it.each([{}, { BATON_API_KEY: "" }, { BATON_API_KEY: "   " }])(
    "refuses to start without an API key (%j)",
    (env) => {
      expect(() => readServerConfig(env)).toThrow(MissingApiKeyError);
    },
  );

  it("says where to create the key", () => {
    expect(MISSING_API_KEY_MESSAGE).toContain("BATON_API_KEY is required");
    expect(MISSING_API_KEY_MESSAGE).toContain("Settings > Account > Developer");
  });

  it("reads the key and the API origin", () => {
    expect(
      readServerConfig({
        BATON_API_KEY: " key-1 ",
        BATON_API_URL: "https://baton.example.com/",
      }),
    ).toEqual({ baseUrl: "https://baton.example.com", apiKey: "key-1" });
  });

  it("defaults the API origin to localhost", () => {
    expect(readServerConfig({ BATON_API_KEY: "key-1" }).baseUrl).toBe(
      "http://localhost:1337",
    );
  });
});
