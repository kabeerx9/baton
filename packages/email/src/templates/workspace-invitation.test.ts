import { render } from "react-email";
import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";
import enUS from "../../../../i18n/en-US.json";
import WorkspaceInvitationEmail from "./workspace-invitation";

describe("WorkspaceInvitationEmail", () => {
  it("renders the invitation from the en-US copy", async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Product Team",
        inviterName: "Camille",
        inviterEmail: "camille@example.com",
        invitationLink: "https://baton.example/invite/abc",
        to: "invite@example.com",
        copy: enUS.invitations.email,
      }),
    );

    expect(html).toContain("Join Product Team");
    expect(html).toContain("Accept invitation");
    expect(html).toContain("Camille (camille@example.com)");
  });
});

describe("WorkspaceInvitationEmail default copy", () => {
  it("renders without a copy prop so previews and exports work", async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Acme Inc",
        inviterName: "John Doe",
        inviterEmail: "john@acme.com",
        invitationLink: "https://baton.example.com/invite/abc123",
        to: "invitee@example.com",
      }),
    );

    expect(html).toContain("Join Acme Inc");
    expect(html).toContain("Accept invitation");
  });

  it("keeps the fallback in sync with the en-US bundle", async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Acme Inc",
        inviterName: "John Doe",
        inviterEmail: "john@acme.com",
        invitationLink: "https://baton.example.com/invite/abc123",
        to: "invitee@example.com",
      }),
    );
    const withEnUs = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Acme Inc",
        inviterName: "John Doe",
        inviterEmail: "john@acme.com",
        invitationLink: "https://baton.example.com/invite/abc123",
        to: "invitee@example.com",
        copy: enUS.invitations.email,
      }),
    );

    expect(html).toBe(withEnUs);
  });

  it("renders the role and expiry with their labels", async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        workspaceName: "Product Team",
        inviterName: "Camille",
        inviterEmail: "camille@example.com",
        invitationLink: "https://baton.example/invite/abc",
        to: "invite@example.com",
        role: "Member",
        expiresAt: new Date("2026-10-13T12:00:00Z"),
        copy: enUS.invitations.email,
      }),
    );

    expect(html).toContain("Invitation details");
    expect(html).toContain("Member");
    expect(html).toContain("Oct 13, 2026");
  });
});
