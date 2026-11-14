import React from "react";
import { EmailButton } from "../components/email-button";
import { EmailFooter } from "../components/email-footer";
import { EmailIntro } from "../components/email-intro";
import { EmailNote } from "../components/email-note";
import { EmailShell } from "../components/email-shell";
import { FallbackLink } from "../components/fallback-link";
import {
  type RequestContext,
  RequestDetails,
} from "../components/request-details";
import { passwordResetReason } from "../components/security-reasons";

void React;

export type PasswordResetEmailProps = RequestContext & {
  resetLink: string;
  userName?: string;
};

const copy = {
  preview:
    "Use the link inside to choose a new password. It expires in 1 hour.",
  title: "Reset your password",
  subtitleWithName: (name: string) =>
    `Hi ${name}, use the button below to choose a new password. The link works once and expires in 1 hour.`,
  subtitleDefault:
    "Use the button below to choose a new password. The link works once and expires in 1 hour.",
  cta: "Reset password",
  fallback: "Button not working? Paste this link into your browser:",
  ignoreTitle: "Didn't ask for this?",
  ignore:
    "You can ignore this email. Your password stays the same until someone opens this link and sets a new one.",
  footer: "Baton security email",
} as const;

const PasswordResetEmail = ({
  resetLink,
  userName,
  email,
  instance,
  requestedAt,
  device,
}: PasswordResetEmailProps) => {
  return (
    <EmailShell title={copy.title} preview={copy.preview} lang="en">
      <EmailIntro
        title={copy.title}
        subtitle={
          userName ? copy.subtitleWithName(userName) : copy.subtitleDefault
        }
      />
      <EmailButton href={resetLink} icon="key-round-light">
        {copy.cta}
      </EmailButton>
      <FallbackLink label={copy.fallback} href={resetLink} />
      <RequestDetails
        email={email}
        instance={instance}
        requestedAt={requestedAt}
        device={device}
      />
      <EmailNote title={copy.ignoreTitle}>{copy.ignore}</EmailNote>
      <EmailFooter
        title={copy.footer}
        reason={email ? passwordResetReason(email, instance) : undefined}
        links={[]}
      />
    </EmailShell>
  );
};

PasswordResetEmail.PreviewProps = {
  resetLink: "https://baton.example.com/auth/reset-password?token=example",
  userName: "Maya",
  email: "maya@example.com",
  instance: "baton.example.com",
  requestedAt: "2026-10-11T14:12:00.000Z",
  device: { browser: "Safari", os: "iPhone" },
} as PasswordResetEmailProps;

export default PasswordResetEmail;
