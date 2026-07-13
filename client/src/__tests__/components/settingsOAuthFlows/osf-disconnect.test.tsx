import {
  docSnap,
  lastOpenedUrl,
  mocks,
  okJson,
  registerSettingsOAuthTokensHooks,
} from "./testHarness";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OsfToken from "../../../pages/Settings/OsfToken";
import { fetchOAuthState } from "../../../lib/oauthState";
import { openExternal } from "../../../lib/openExternal";

describe("Settings OAuth tokens", () => {
  registerSettingsOAuthTokensHooks();

  it("cancels OSF disconnects and reports disconnect failures", async () => {
    mocks.getDoc.mockResolvedValue(
      docSnap({
        osfTokens: { access_token: "osf-oauth-token" },
        osfUserName: "OSF User",
        osfProjectId: "abc12",
      }),
    );
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    render(<OsfToken />);

    expect(await screen.findByText(/OSF User/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(fetch).not.toHaveBeenCalled();

    cleanup();
    vi.clearAllMocks();
    mocks.getDoc.mockResolvedValue(
      docSnap({
        osfTokens: { access_token: "osf-oauth-token" },
        osfUserName: "OSF User",
        osfProjectId: "abc12",
      }),
    );
    vi.mocked(window.confirm).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValueOnce(
      okJson({ success: false, message: "Cannot disconnect" }),
    );

    render(<OsfToken />);

    expect(await screen.findByText(/OSF User/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Error: Cannot disconnect");
    });
    expect(console.error).toHaveBeenCalledWith(
      "Error deleting OSF token:",
      expect.any(Error),
    );
  });

  it("uses OSF disconnect defaults for sparse responses and thrown values", async () => {
    const connectedDoc = docSnap({
      osfTokens: { access_token: "osf-oauth-token" },
    });
    mocks.getDoc.mockResolvedValue(connectedDoc);
    vi.mocked(fetch).mockResolvedValueOnce(okJson({ success: false }));
    const responseFailureView = render(<OsfToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Error: Failed to disconnect");
    });
    responseFailureView.unmount();

    mocks.getDoc.mockResolvedValue(connectedDoc);
    vi.mocked(fetch).mockRejectedValueOnce("offline");
    render(<OsfToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Error: Error disconnecting OSF",
      );
    });
  });

  it("opens OSF OAuth with signed state and disconnects through osfManage", async () => {
    render(<OsfToken />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    await waitFor(() => {
      expect(fetchOAuthState).toHaveBeenCalledWith("osf");
      expect(openExternal).toHaveBeenCalled();
    });
    const url = lastOpenedUrl();
    expect(url.origin).toBe("https://accounts.osf.io");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("state")).toBe("signed-state-123");
    expect(url.searchParams.get("state")).not.toBe("user-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:5173/oauth/osf/callback",
    );

    cleanup();
    vi.clearAllMocks();
    mocks.getDoc.mockResolvedValue(
      docSnap({
        osfTokens: { access_token: "osf-oauth-token" },
        osfUserName: "OSF User",
        osfProjectId: "abc12",
      }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(okJson({ success: true }));

    render(<OsfToken />);

    expect(await screen.findByText(/OSF User/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:5001/test-e4cf9/us-central1/osfManage",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            action: "disconnect",
            uid: "user-123",
          }),
        }),
      );
    });
    expect(window.alert).toHaveBeenCalledWith("OSF disconnected successfully!");
  });
});
