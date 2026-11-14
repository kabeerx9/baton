import { render } from "react-email";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import AccountPasswordEmail from "./account-password";

const link = "https://baton.example/api/auth/reset-password/abc";

describe("AccountPasswordEmail", () => {
  it("invites a new account to set a password instead of resetting one", async () => {
    const html = await render(
      createElement(AccountPasswordEmail, {
        purpose: "setup",
        passwordLink: link,
        userName: "Maya",
        email: "maya@example.com",
        instance: "baton.example",
      }),
    );
    expect(html).toContain("Set up your Baton account");
    expect(html).toContain("expires in 2 days");
    expect(html).toContain("an administrator of baton.example");
    expect(html).not.toContain("Reset");
    expect(html).toContain(link);
  });

  it("explains an administrator-sent reset link", async () => {
    const html = await render(
      createElement(AccountPasswordEmail, {
        purpose: "reset",
        passwordLink: link,
      }),
    );
    expect(html).toContain("Choose a new password");
    expect(html).toContain("expires in 1 hour");
  });
});
