import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";

describe("API integration: config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["true", "false", undefined])(
    "returns cloud mode for BATON_CLOUD=%s",
    async (value) => {
      vi.stubEnv("BATON_CLOUD", value);
      const response = await createApp().app.request("/api/config");
      expect(response.status).toBe(200);
      expect(await response.json()).toHaveProperty("isCloud", value === "true");
    },
  );

  it("returns the public config shape", async () => {
    const { app } = createApp();

    const response = await app.request("/api/config");

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({
      disableRegistration: false,
      disablePasswordRegistration: false,
    });
    expect(Object.keys(payload).sort()).toEqual(
      [
        "disablePasswordRegistration",
        "disableRegistration",
        "disableWorkspaceCreation",
        "disabledIntegrations",
        "hasImageUploads",
        "hasSmtp",
        "instanceName",
        "isCloud",
      ].sort(),
    );
  });

  it.each([
    [{ S3_ENDPOINT: "https://s3.example.com", S3_BUCKET: "baton" }, true],
    [{ S3_ENDPOINT: "", S3_BUCKET: "" }, false],
  ])(
    "reports image uploads from the storage settings %o",
    async (storage, expected) => {
      for (const [key, value] of Object.entries(storage)) {
        vi.stubEnv(key, value);
      }
      const response = await createApp().app.request("/api/config");
      expect(await response.json()).toHaveProperty("hasImageUploads", expected);
    },
  );
});
