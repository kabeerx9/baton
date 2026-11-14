import React from "react";
import { EmailButton } from "../components/email-button";
import { EmailFooter } from "../components/email-footer";
import { EmailIntro } from "../components/email-intro";
import { EmailNote } from "../components/email-note";
import { EmailShell } from "../components/email-shell";
import { FallbackLink } from "../components/fallback-link";
import { administratorReason } from "../components/security-reasons";

void React;

/**
 * `setup`: an administrator created the account and the person chooses their
 * first password. `reset`: an administrator sent a link to choose a new one.
 */
export type AccountPasswordPurpose = "setup" | "reset";

export type AccountPasswordEmailProps = {
  purpose: AccountPasswordPurpose;
  passwordLink: string;
  userName?: string;
  email?: string;
  instance?: string;
};

type Copy = {
  preview: string;
  title: string;
  subtitle: (name?: string) => string;
  cta: string;
  noteTitle: string;
  note: string;
};

const fallback = "Button not working? Paste this link into your browser:";

const footer = "Baton account email";

const setup: Copy = {
  preview:
    "An administrator created a Baton account for you. Choose a password to sign in.",
  title: "Set up your Baton account",
  subtitle: (name) =>
    `${name ? `Hi ${name}, an` : "An"} administrator created a Baton account for you. Choose a password to sign in. The link works once and expires in 2 days.`,
  cta: "Set password",
  noteTitle: "Not expecting this?",
  note: "You can ignore this email. No password is set until someone opens this link and chooses one.",
};

const reset: Copy = {
  preview:
    "An administrator sent you a link to choose a new password. It expires in 1 hour.",
  title: "Choose a new password",
  subtitle: (name) =>
    `${name ? `Hi ${name}, an` : "An"} administrator sent you a link to choose a new Baton password. The link works once and expires in 1 hour.`,
  cta: "Choose new password",
  noteTitle: "Don't need a new password?",
  note: "You can ignore this email. Your password stays the same until someone opens this link and sets a new one.",
};

const AccountPasswordEmail = ({
  purpose,
  passwordLink,
  userName,
  email,
  instance,
}: AccountPasswordEmailProps) => {
  const copy = purpose === "setup" ? setup : reset;

  return (
    <EmailShell title={copy.title} preview={copy.preview} lang="en">
      <EmailIntro title={copy.title} subtitle={copy.subtitle(userName)} />
      <EmailButton href={passwordLink} icon="key-round-light">
        {copy.cta}
      </EmailButton>
      <FallbackLink label={fallback} href={passwordLink} />
      <EmailNote title={copy.noteTitle}>{copy.note}</EmailNote>
      <EmailFooter
        title={footer}
        reason={email ? administratorReason(email, instance) : undefined}
        links={[]}
      />
    </EmailShell>
  );
};

AccountPasswordEmail.PreviewProps = {
  purpose: "setup",
  passwordLink: "https://baton.example.com/auth/reset-password?token=example",
  userName: "Maya",
  email: "maya@example.com",
  instance: "baton.example.com",
} as AccountPasswordEmailProps;

export default AccountPasswordEmail;
