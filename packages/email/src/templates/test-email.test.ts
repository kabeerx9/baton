import { render } from "react-email";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import TestEmail from "./test-email";

describe("TestEmail", () => {
  it("names the recipient and instance without any links into Baton", async () => {
    const html = await render(
      createElement(TestEmail, {
        email: "admin@example.com",
        instance: "baton.example.com",
      }),
    );

    expect(html).toContain("Your email settings work");
    expect(html).toContain("admin@example.com");
    expect(html).toContain("baton.example.com");
    expect(html).not.toMatch(/href="https?:\/\/baton\.example\.com/);
  });
});
