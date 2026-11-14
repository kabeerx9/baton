import { render } from "react-email";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import PasswordResetEmail from "./password-reset";

describe("PasswordResetEmail", () => {
  it("renders the reset link and English copy", async () => {
    const html = await render(
      createElement(PasswordResetEmail, {
        resetLink: "https://baton.example/reset",
      }),
    );
    expect(html).toContain("Reset your password");
    expect(html).toContain("Baton security email");
    expect(html).toContain("https://baton.example/reset");
  });
});
