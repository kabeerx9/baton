import { render } from "react-email";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import EmailVerificationEmail from "./email-verification";

describe("EmailVerificationEmail", () => {
  it("asks the person to confirm their address", async () => {
    const html = await render(
      createElement(EmailVerificationEmail, {
        verificationLink: "https://baton.example/api/auth/verify-email?token=x",
      }),
    );
    expect(html).toContain("Confirm your email address");
    expect(html).toContain("verify-email?token=x");
  });
});
