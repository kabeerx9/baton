import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { describeAuth } from "./describe-auth";

const githubStatus = () =>
  describeAuth().providers.find((provider) => provider.id === "github")?.status;

describe("describeAuth", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("disables password registration with registration", () => {
    vi.stubEnv("DISABLE_REGISTRATION", "true");
    vi.stubEnv("DISABLE_PASSWORD_REGISTRATION", "false");

    expect(describeAuth().passwordRegistration).toBe(false);
  });

  it("warns about an incomplete GitHub credential pair", () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "oauth-id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "");

    expect(githubStatus()).toBe("warning");
  });

  it("warns about an unused GitHub secret file without reading it", () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "");
    vi.stubEnv(
      "GITHUB_OAUTH_CLIENT_SECRET_FILE",
      "/missing/baton-github-secret",
    );
    expect(githubStatus()).toBe("warning");
  });

  it("reports GitHub as configured from the complete pair", () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "oauth-id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "oauth-secret");

    expect(githubStatus()).toBe("ok");
  });
});
