import * as email from "@baton/email";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";

// Older installs may still set DISABLE_LOGIN_FORM. Email and password is now
// the only sign-in method, so the stale flag must not lock anyone out.
vi.hoisted(() => {
  process.env.DISABLE_LOGIN_FORM = "true";
});
afterEach(() => vi.restoreAllMocks());

it("keeps password reset available when a stale DISABLE_LOGIN_FORM is set", async () => {
  vi.spyOn(email, "isSmtpConfigured").mockReturnValue(true);
  const response = await auth.handler(
    new Request("http://localhost:1337/api/auth/request-password-reset", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({ email: "nobody@example.com" }),
    }),
  );
  expect(response.status, await response.clone().text()).toBe(200);
});
