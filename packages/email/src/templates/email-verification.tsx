import React from "react";
import { EmailButton } from "../components/email-button";
import { EmailFooter } from "../components/email-footer";
import { EmailIntro } from "../components/email-intro";
import { EmailNote } from "../components/email-note";
import { EmailShell } from "../components/email-shell";
import { FallbackLink } from "../components/fallback-link";
import {
  administratorReason,
  signUpReason,
} from "../components/security-reasons";

void React;

export type EmailVerificationEmailProps = {
  verificationLink: string;
  userName?: string;
  email?: string;
  instance?: string;
  /** Who asked for the email. Defaults to an administrator. */
  requestedBy?: "administrator" | "sign-up";
};

const copy = {
  preview: "Confirm that this email address belongs to you.",
  title: "Confirm your email address",
  subtitle: (name?: string) =>
    `${name ? `Hi ${name}, please` : "Please"} confirm that this address belongs to you so it can be used with your Baton account. The link expires in 24 hours.`,
  cta: "Confirm email",
  fallback: "Button not working? Paste this link into your browser:",
  noteTitle: "Not your account?",
  note: "You can ignore this email. Nothing changes unless someone opens this link.",
  footer: "Baton account email",
} as const;

const EmailVerificationEmail = ({
  verificationLink,
  userName,
  email,
  instance,
  requestedBy = "administrator",
}: EmailVerificationEmailProps) => {
  return (
    <EmailShell title={copy.title} preview={copy.preview} lang="en">
      <EmailIntro title={copy.title} subtitle={copy.subtitle(userName)} />
      <EmailButton href={verificationLink} icon="check-circle-light">
        {copy.cta}
      </EmailButton>
      <FallbackLink label={copy.fallback} href={verificationLink} />
      <EmailNote title={copy.noteTitle}>{copy.note}</EmailNote>
      <EmailFooter
        title={copy.footer}
        reason={
          email
            ? (requestedBy === "sign-up" ? signUpReason : administratorReason)(
                email,
                instance,
              )
            : undefined
        }
        links={[]}
      />
    </EmailShell>
  );
};

EmailVerificationEmail.PreviewProps = {
  verificationLink:
    "https://baton.example.com/api/auth/verify-email?token=example",
  userName: "Maya",
  email: "maya@example.com",
  instance: "baton.example.com",
} as EmailVerificationEmailProps;

export default EmailVerificationEmail;
