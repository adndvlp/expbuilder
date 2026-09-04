import { describe, expect, it } from "vitest";
import {
  OAUTH_PORT_IN_USE_MESSAGE,
  isOAuthPortInUseError,
  oauthStartErrorMessage,
} from "../../lib/oauthPortError";

describe("oauthPortError", () => {
  it("maps occupied-port IPC errors to the visible OAuth message", () => {
    expect(isOAuthPortInUseError("Port 8888 is not available")).toBe(true);
    expect(
      isOAuthPortInUseError("listen EADDRINUSE: address already in use :::8888"),
    ).toBe(true);
    expect(oauthStartErrorMessage("Port 8888 is not available")).toBe(
      OAUTH_PORT_IN_USE_MESSAGE,
    );
    expect(oauthStartErrorMessage(OAUTH_PORT_IN_USE_MESSAGE)).toBe(
      OAUTH_PORT_IN_USE_MESSAGE,
    );
  });

  it("leaves unrelated OAuth errors unchanged", () => {
    expect(isOAuthPortInUseError("Unsupported provider: unknown")).toBe(false);
    expect(oauthStartErrorMessage("OAuth callback timeout")).toBe(
      "OAuth callback timeout",
    );
    expect(oauthStartErrorMessage(undefined)).toBe("OAuth flow failed");
  });
});
