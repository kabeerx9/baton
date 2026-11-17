import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]).toString("base64");

type SessionResponse = { user: { image: string | null; name: string } } | null;

function applyCookies(existing: string, response: Response) {
  const jar = new Map<string, string>();

  for (const pair of existing.split("; ").filter(Boolean)) {
    const [name, ...value] = pair.split("=");
    if (name) jar.set(name, value.join("="));
  }

  for (const setCookie of response.headers.getSetCookie()) {
    const [pair] = setCookie.split(";");
    const [name, ...value] = (pair ?? "").split("=");
    if (!name) continue;
    if (value.join("=") === "") {
      jar.delete(name);
      continue;
    }
    jar.set(name, value.join("="));
  }

  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function collectCookies(response: Response) {
  return applyCookies("", response);
}

async function signUp(app: ReturnType<typeof createApp>["app"]) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "avatar-session@example.com",
      password: "correct horse battery staple",
      name: "Avatar Session",
    }),
  });

  expect(response.status).toBe(200);
  const cookies = collectCookies(response);
  expect(cookies).not.toBe("");

  return cookies;
}

describe("API integration: session freshness after profile updates", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("serves an uploaded picture with and without a cookie-cache bypass", async () => {
    const { app } = createApp();
    const cookies = await signUp(app);

    const upload = await app.request("/api/user/avatar", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: cookies },
      body: JSON.stringify({ contentType: "image/png", data: PNG }),
    });
    expect(upload.status).toBe(200);
    const { url } = (await upload.json()) as { url: string };

    const current = (await (
      await app.request("/api/auth/get-session", {
        headers: { cookie: cookies },
      })
    ).json()) as SessionResponse;
    expect(current?.user.image).toBe(url);

    const fresh = (await (
      await app.request("/api/auth/get-session?disableCookieCache=true", {
        headers: { cookie: cookies },
      })
    ).json()) as SessionResponse;
    expect(fresh?.user.image).toBe(url);
  });

  it("never lets update-user point the session at an arbitrary URL", async () => {
    const { app } = createApp();
    const cookies = await signUp(app);

    const update = await app.request("/api/auth/update-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies },
      body: JSON.stringify({ image: "/api/user/avatar/new-avatar-id" }),
    });
    expect(update.status).toBe(200);

    const fresh = (await (
      await app.request("/api/auth/get-session?disableCookieCache=true", {
        headers: { cookie: cookies },
      })
    ).json()) as SessionResponse;
    expect(fresh?.user.image).toBeNull();
  });

  it("keeps profile changes fresh without issuing session-data cookies", async () => {
    const { app } = createApp();
    const cookies = await signUp(app);

    await app.request("/api/auth/update-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies },
      body: JSON.stringify({ name: "Renamed User" }),
    });

    const refreshed = await app.request(
      "/api/auth/get-session?disableCookieCache=true",
      {
        headers: { cookie: cookies },
      },
    );

    expect(
      refreshed.headers
        .getSetCookie()
        .some((cookie) => cookie.includes("session_data=")),
    ).toBe(false);

    const nextCookies = applyCookies(cookies, refreshed);
    const current = (await (
      await app.request("/api/auth/get-session", {
        headers: { cookie: nextCookies },
      })
    ).json()) as SessionResponse;

    expect(current?.user.name).toBe("Renamed User");
  });
});
