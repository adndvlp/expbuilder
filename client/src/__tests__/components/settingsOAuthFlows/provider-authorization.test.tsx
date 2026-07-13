import {
  docSnap,
  lastOpenedUrl,
  mocks,
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
import GoogleDriveToken from "../../../pages/Settings/GoogleDrive/GoogleDriveToken";
import DropboxToken from "../../../pages/Settings/Dropbox/DropboxToken";
import GithubToken from "../../../pages/Settings/Github/GithubToken";
import {
  getOsfManageUrl,
  getOsfOAuthExchangeUrl,
  getOsfRedirectUri,
} from "../../../pages/Settings/OsfToken";
import { doc, updateDoc } from "firebase/firestore";
import { fetchOAuthState } from "../../../lib/oauthState";
import { openExternal } from "../../../lib/openExternal";

describe("Settings OAuth tokens", () => {
  registerSettingsOAuthTokensHooks();

  it("builds OSF URLs for Electron, development and production", () => {
    expect(getOsfRedirectUri(true, true)).toBe(
      "http://localhost:8888/oauth/osf/callback",
    );
    expect(getOsfRedirectUri(false, true)).toBe(
      "http://localhost:5173/oauth/osf/callback",
    );
    expect(getOsfRedirectUri(false, false, "https://example.test/osf")).toBe(
      "https://example.test/osf",
    );
    expect(getOsfRedirectUri(false, false)).toBe(
      "https://us-central1-test-e4cf9.cloudfunctions.net/osfOAuthCallback",
    );
    expect(getOsfManageUrl(true)).toContain("127.0.0.1:5001");
    expect(getOsfManageUrl(false)).toBe(
      "https://us-central1-test-e4cf9.cloudfunctions.net/osfManage",
    );
    expect(
      getOsfOAuthExchangeUrl(true, "a b", "signed/state", "http://local/cb"),
    ).toBe(
      "http://127.0.0.1:5001/test-e4cf9/us-central1/osfOAuthCallback?code=a%20b&state=signed%2Fstate&redirect_uri=http%3A%2F%2Flocal%2Fcb",
    );
    expect(
      getOsfOAuthExchangeUrl(
        false,
        "code",
        "state",
        "https://app.test/callback",
      ),
    ).toContain(
      "https://us-central1-test-e4cf9.cloudfunctions.net/osfOAuthCallback",
    );
  });

  it("opens provider OAuth URLs with backend-signed state instead of uid state", async () => {
    const cases = [
      {
        Component: GoogleDriveToken,
        provider: "googledrive",
        origin: "https://accounts.google.com",
        pathname: "/o/oauth2/v2/auth",
        redirectUri: "http://localhost:5173/google-drive-callback",
      },
      {
        Component: DropboxToken,
        provider: "dropbox",
        origin: "https://www.dropbox.com",
        pathname: "/oauth2/authorize",
        redirectUri: "http://localhost:5173/dropbox-callback",
      },
      {
        Component: GithubToken,
        provider: "github",
        origin: "https://github.com",
        pathname: "/login/oauth/authorize",
        redirectUri: "http://localhost:5173/github-callback",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
      mocks.getDoc.mockResolvedValue(docSnap({}));

      render(<item.Component />);

      fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(fetchOAuthState).toHaveBeenCalledWith(item.provider);
        expect(openExternal).toHaveBeenCalled();
      });

      const url = lastOpenedUrl();
      expect(url.origin).toBe(item.origin);
      expect(url.pathname).toBe(item.pathname);
      expect(url.searchParams.get("state")).toBe("signed-state-123");
      expect(url.searchParams.get("state")).not.toBe("user-123");
      expect(url.searchParams.get("redirect_uri")).toBe(item.redirectUri);
    }
  });

  it("disconnects stored Drive, Dropbox and GitHub tokens from the user doc", async () => {
    const cases = [
      {
        Component: GoogleDriveToken,
        tokenData: { googleDriveTokens: { access_token: "drive-token" } },
        clearedField: "googleDriveTokens",
      },
      {
        Component: DropboxToken,
        tokenData: { dropboxTokens: { access_token: "dropbox-token" } },
        clearedField: "dropboxTokens",
      },
      {
        Component: GithubToken,
        tokenData: { githubTokens: { access_token: "github-token" } },
        clearedField: "githubTokens",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockResolvedValue(docSnap(item.tokenData));
      mocks.updateDoc.mockResolvedValue(undefined);

      render(<item.Component />);

      expect(await screen.findByText(/Connected/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

      await waitFor(() => {
        expect(doc).toHaveBeenCalledWith(mocks.db, "users", "user-123");
        expect(updateDoc).toHaveBeenCalledWith(
          "users/user-123",
          expect.objectContaining({
            [item.clearedField]: null,
            uid: "user-123",
          }),
        );
      });
    }
  });
});
