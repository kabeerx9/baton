type Reason = (email: string, instance?: string) => string;

export const signInReason: Reason = (email, instance = "Baton") =>
  `Sent to ${email} because someone asked to sign in to ${instance}.`;

export const signUpReason: Reason = (email, instance = "Baton") =>
  `Sent to ${email} because someone created an account on ${instance} with this address.`;

export const passwordResetReason: Reason = (email, instance = "Baton") =>
  `Sent to ${email} because someone asked to reset the password on ${instance}.`;

export const administratorReason: Reason = (email, instance = "Baton") =>
  `Sent to ${email} because an administrator of ${instance} asked Baton to send it.`;
