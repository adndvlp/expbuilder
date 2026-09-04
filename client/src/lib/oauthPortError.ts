const PORT_IN_USE_PATTERN =
  /OAuth cannot start because port \d+ is already in use/;

export const OAUTH_PORT_IN_USE_MESSAGE =
  "OAuth cannot start because port 8888 is already in use. Close the other application using that port and try again. This port is registered as the OAuth redirect and cannot be changed.";

export function isOAuthPortInUseError(error?: string | null): boolean {
  if (!error) return false;
  return (
    PORT_IN_USE_PATTERN.test(error) ||
    error.includes("Port 8888 is not available") ||
    (error.includes("EADDRINUSE") && error.includes("8888"))
  );
}

export function oauthStartErrorMessage(error?: string | null): string {
  if (!error) return "OAuth flow failed";
  if (PORT_IN_USE_PATTERN.test(error)) return error;
  if (isOAuthPortInUseError(error)) return OAUTH_PORT_IN_USE_MESSAGE;
  return error;
}
