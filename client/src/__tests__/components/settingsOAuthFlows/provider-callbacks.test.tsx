import {
  mocks,
  registerSettingsOAuthCallbackPagesHooks,
  stubLocation,
} from "./testHarness";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GoogleDriveCallback, {
  getGoogleDriveOAuthCallbackUrl,
} from "../../../pages/Settings/GoogleDrive/GoogleDriveCallback";
import DropboxCallback, {
  getDropboxOAuthCallbackUrl,
} from "../../../pages/Settings/Dropbox/DropboxCallback";
import GithubCallback, {
  getGithubOAuthCallbackUrl,
} from "../../../pages/Settings/Github/GithubCallback";

describe("Settings OAuth callback pages", () => {
  registerSettingsOAuthCallbackPagesHooks();

  it("builds deployed callback URLs for all providers", () => {
    expect(getGoogleDriveOAuthCallbackUrl(false, "a b", "signed/state")).toBe(
      "https://us-central1-test-e4cf9.cloudfunctions.net/googleDriveOAuthCallback?code=a%20b&state=signed%2Fstate",
    );
    expect(getDropboxOAuthCallbackUrl(false, "a b", "signed/state")).toBe(
      "https://us-central1-test-e4cf9.cloudfunctions.net/dropboxOAuthCallback?code=a%20b&state=signed%2Fstate",
    );
    expect(getGithubOAuthCallbackUrl(false, "a b", "signed/state")).toBe(
      "https://us-central1-test-e4cf9.cloudfunctions.net/githubOAuthCallback?code=a%20b&state=signed%2Fstate",
    );
  });

  it("redirects Drive, Dropbox and GitHub callback codes to their Cloud Functions", async () => {
    const cases = [
      {
        Component: GoogleDriveCallback,
        title: "Connecting Google Drive...",
        endpoint: "googleDriveOAuthCallback",
      },
      {
        Component: DropboxCallback,
        title: "Connecting Dropbox...",
        endpoint: "dropboxOAuthCallback",
      },
      {
        Component: GithubCallback,
        title: "Connecting GitHub...",
        endpoint: "githubOAuthCallback",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      const location = stubLocation();
      mocks.searchParams = new URLSearchParams({
        code: "code value",
        state: "signed/state",
      });

      render(<item.Component />);

      expect(await screen.findByText(item.title)).toBeInTheDocument();
      await waitFor(() => {
        expect(location.href).toContain(item.endpoint);
        expect(location.href).toContain("code=code%20value");
        expect(location.href).toContain("state=signed%2Fstate");
      });
      expect(mocks.navigate).not.toHaveBeenCalled();
    }
  });

  it("routes provider callback errors back to Settings with service metadata", async () => {
    mocks.searchParams = new URLSearchParams({ error: "access_denied" });

    render(<GithubCallback />);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/settings?status=error&service=github&message=access_denied",
      );
    });
  });

  it("routes Drive and Dropbox callback errors back to Settings", async () => {
    const cases = [
      {
        Component: GoogleDriveCallback,
        service: "google-drive",
      },
      {
        Component: DropboxCallback,
        service: "dropbox",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.searchParams = new URLSearchParams({ error: "access denied" });

      render(<item.Component />);

      await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith(
          `/settings?status=error&service=${item.service}&message=access%20denied`,
        );
      });
    }
  });

  it("routes missing OAuth callback parameters back to Settings", async () => {
    const cases = [
      {
        Component: GoogleDriveCallback,
        service: "google-drive",
      },
      {
        Component: DropboxCallback,
        service: "dropbox",
      },
      {
        Component: GithubCallback,
        service: "github",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.searchParams = new URLSearchParams({ code: "only-code" });

      render(<item.Component />);

      await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith(
          `/settings?status=error&service=${item.service}&message=Missing parameters`,
        );
      });
    }
  });

  it("routes redirect assignment failures back to Settings", async () => {
    const cases = [
      {
        Component: GoogleDriveCallback,
        service: "google-drive",
      },
      {
        Component: DropboxCallback,
        service: "dropbox",
      },
      {
        Component: GithubCallback,
        service: "github",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      const throwingLocation = {};
      Object.defineProperty(throwingLocation, "href", {
        configurable: true,
        get: () => "http://localhost/",
        set: () => {
          throw new Error("redirect blocked");
        },
      });
      Object.defineProperty(window, "location", {
        configurable: true,
        value: throwingLocation,
      });
      mocks.searchParams = new URLSearchParams({
        code: "code",
        state: "state",
      });

      render(<item.Component />);

      await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith(
          `/settings?status=error&service=${item.service}&message=redirect%20blocked`,
        );
      });
    }
  });
});
