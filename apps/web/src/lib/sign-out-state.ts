// Keep late 401 responses from replacing a pending identity-provider navigation.
export const signOutState = {
  isRedirecting: false,
  /** One-shot: the sign-in page says the sign-out worked, once. */
  justSignedOut: false,
};
