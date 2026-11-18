import i18n from "i18next";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { workspaceWriteErrorMessage } from "./workspace-write-error-message";

beforeAll(async () => {
  if (!i18n.isInitialized) await i18n.init({ lng: "en", resources: {} });
});

describe("workspaceWriteErrorMessage", () => {
  it("uses Baton's copy for a known code", () => {
    const message = workspaceWriteErrorMessage(
      new HttpError(409, "raw", { code: "ROLE_IN_USE" }),
      "fallback",
    );
    expect(message).not.toBe("raw");
    expect(message).toContain("ROLE_IN_USE");
  });

  it("keeps the server message for an unknown code", () => {
    expect(
      workspaceWriteErrorMessage(
        new HttpError(400, "Name too long", { code: "VALIDATION" }),
        "fallback",
      ),
    ).toBe("Name too long");
  });

  it("falls back when there is nothing to show", () => {
    expect(workspaceWriteErrorMessage(null, "fallback")).toBe("fallback");
  });
});
