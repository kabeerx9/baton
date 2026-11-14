import { describe, expect, it } from "vite-plus/test";
import { getInvitationEmailSubject } from "../../../apps/api/src/utils/get-invitation-email-subject";

describe("getInvitationEmailSubject", () => {
  it("uses the English subject", () => {
    expect(getInvitationEmailSubject("Alice", "Producto")).toBe(
      "Alice invited you to join Producto on Baton",
    );
  });

  it("names the instance", () => {
    expect(getInvitationEmailSubject("Alice", "Team", "Acme Tasks")).toBe(
      "Alice invited you to join Team on Acme Tasks",
    );
  });

  it("keeps unicode names unchanged", () => {
    expect(getInvitationEmailSubject("Zoë", "Équipe produit")).toBe(
      "Zoë invited you to join Équipe produit on Baton",
    );
  });
});
