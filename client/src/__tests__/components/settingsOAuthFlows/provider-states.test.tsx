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
import OsfToken from "../../../pages/Settings/OsfToken";

import { fetchOAuthState } from "../../../lib/oauthState";
import { openExternal } from "../../../lib/openExternal";

describe("Settings OAuth tokens", () => {
  registerSettingsOAuthTokensHooks();

  it("shows OAuth state failures without opening a provider window", async () => {
    mocks.fetchOAuthState.mockRejectedValueOnce(new Error("state unavailable"));

    render(<GithubToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Could not start OAuth flow: state unavailable",
      );
    });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("shows Dropbox OAuth state failures without opening a provider window", async () => {
    mocks.fetchOAuthState.mockRejectedValueOnce(new Error("state unavailable"));

    render(<DropboxToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Could not start OAuth flow: state unavailable",
      );
    });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("shows Google Drive OAuth state failures without opening a provider window", async () => {
    mocks.fetchOAuthState.mockRejectedValueOnce(new Error("state unavailable"));

    render(<GoogleDriveToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Could not start OAuth flow: state unavailable",
      );
    });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders Google Drive disconnected state without a signed-in user and ignores connect clicks", async () => {
    mocks.auth.currentUser = null;

    render(<GoogleDriveToken />);

    expect(await screen.findByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(fetchOAuthState).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders Google Drive disconnected state when the user document is missing", async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });

    render(<GoogleDriveToken />);

    expect(await screen.findByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
  });

  it("renders Dropbox disconnected state without a signed-in user and ignores connect clicks", async () => {
    mocks.auth.currentUser = null;

    render(<DropboxToken />);

    expect(await screen.findByText("Dropbox")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(fetchOAuthState).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders Dropbox disconnected state when the user document is missing", async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });

    render(<DropboxToken />);

    expect(await screen.findByText("Dropbox")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
  });

  it("renders GitHub disconnected state without a signed-in user and ignores connect clicks", async () => {
    mocks.auth.currentUser = null;

    render(<GithubToken />);

    expect(await screen.findByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(fetchOAuthState).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders GitHub disconnected state when the user document is missing", async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });

    render(<GithubToken />);

    expect(await screen.findByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
  });

  it("uses the production Dropbox callback URL outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");

    const { default: ProductionDropboxToken } = await import(
      "../../../pages/Settings/Dropbox/DropboxToken"
    );
    render(<ProductionDropboxToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(openExternal).toHaveBeenCalled();
    });
    expect(lastOpenedUrl().searchParams.get("redirect_uri")).toBe(
      "https://test-e4cf9.firebaseapp.com/dropbox-callback",
    );
  });

  it("uses the production Google Drive callback URL outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");

    const { default: ProductionGoogleDriveToken } = await import(
      "../../../pages/Settings/GoogleDrive/GoogleDriveToken"
    );
    render(<ProductionGoogleDriveToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(openExternal).toHaveBeenCalled();
    });
    expect(lastOpenedUrl().searchParams.get("redirect_uri")).toBe(
      "https://test-e4cf9.firebaseapp.com/google-drive-callback",
    );
  });

  it("uses the production GitHub callback URL outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");

    const { default: ProductionGithubToken } = await import(
      "../../../pages/Settings/Github/GithubToken"
    );
    render(<ProductionGithubToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(openExternal).toHaveBeenCalled();
    });
    expect(lastOpenedUrl().searchParams.get("redirect_uri")).toBe(
      "https://test-e4cf9.firebaseapp.com/github-callback",
    );
  });

  it("logs provider token load failures and renders disconnected state", async () => {
    const cases = [
      { Component: GoogleDriveToken, provider: "Google Drive" },
      { Component: DropboxToken, provider: "Dropbox" },
      { Component: GithubToken, provider: "GitHub" },
      { Component: OsfToken, provider: "OSF (Open Science Framework)" },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockRejectedValue(new Error("load failed"));

      render(<item.Component />);

      expect(await screen.findByText(item.provider)).toBeInTheDocument();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error loading token status"),
        expect.any(Error),
      );
      expect(
        screen.getByText(/Not connected|Not Connected/),
      ).toBeInTheDocument();
    }
  });

  it("logs Drive, Dropbox and GitHub disconnect failures without clearing the token", async () => {
    const cases = [
      {
        Component: GoogleDriveToken,
        tokenData: { googleDriveTokens: { access_token: "drive-token" } },
        logPrefix: "Error deleting Google Drive token:",
      },
      {
        Component: DropboxToken,
        tokenData: { dropboxTokens: { access_token: "dropbox-token" } },
        logPrefix: "Error deleting Dropbox token:",
      },
      {
        Component: GithubToken,
        tokenData: { githubTokens: { access_token: "github-token" } },
        logPrefix: "Error deleting GitHub token:",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockResolvedValue(docSnap(item.tokenData));
      mocks.updateDoc.mockRejectedValue(new Error("disconnect failed"));

      render(<item.Component />);

      expect(await screen.findByText(/Connected/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          item.logPrefix,
          expect.any(Error),
        );
      });
      expect(screen.getByText(/Connected/)).toBeInTheDocument();
    }
  });
});
