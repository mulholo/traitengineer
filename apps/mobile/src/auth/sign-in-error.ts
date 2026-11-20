import { ApiError } from "../api/client";

export const INCORRECT_CREDENTIALS = "Email or password is incorrect.";

/**
 * The message to show after a failed email + password sign-in. Only a 401 means the credentials were wrong (the
 * server returns the same answer for an unknown email and a wrong password, and so do we). Anything else, such as
 * rate limiting, a network failure or a misconfigured API URL, is shown as it is so it isn't mistaken for a typo.
 */
export function signInErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return INCORRECT_CREDENTIALS;
  if (error instanceof Error && error.message) return error.message;
  return "Sign in failed. Please try again.";
}
