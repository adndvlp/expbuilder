import { registerSettingsOAuthElectronFlowsHooks } from "./testHarness";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("Settings OAuth Electron flows", () => {
  registerSettingsOAuthElectronFlowsHooks();

  it("shows Dropbox connecting state and default Electron OAuth failure text", async () => {
    let resolveFlow: (value: { success: false }) => void = () => {};
    (window as any).electron.startOAuthFlow.mockReturnValue(
      new Promise((resolve) => {
        resolveFlow = resolve;
      }),
    );
    const { default: DropboxToken } = await import(
      "../../../pages/Settings/Dropbox/DropboxToken"
    );

    render(<DropboxToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Connecting...")).toBeInTheDocument();

    resolveFlow({ success: false });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Error: OAuth flow failed");
    });
  });

  it("shows Google Drive connecting state and default Electron OAuth failure text", async () => {
    let resolveFlow: (value: { success: false }) => void = () => {};
    (window as any).electron.startOAuthFlow.mockReturnValue(
      new Promise((resolve) => {
        resolveFlow = resolve;
      }),
    );
    const { default: GoogleDriveToken } = await import(
      "../../../pages/Settings/GoogleDrive/GoogleDriveToken"
    );

    render(<GoogleDriveToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Connecting...")).toBeInTheDocument();

    resolveFlow({ success: false });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Error: OAuth flow failed");
    });
  });

  it("shows GitHub connecting state and default Electron OAuth failure text", async () => {
    let resolveFlow: (value: { success: false }) => void = () => {};
    (window as any).electron.startOAuthFlow.mockReturnValue(
      new Promise((resolve) => {
        resolveFlow = resolve;
      }),
    );
    const { default: GithubToken } = await import(
      "../../../pages/Settings/Github/GithubToken"
    );

    render(<GithubToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Connecting...")).toBeInTheDocument();

    resolveFlow({ success: false });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Error: OAuth flow failed");
    });
  });

  it("alerts when OAuth credentials are not configured for the Electron flow", async () => {
    const cases = [
      {
        Component: (await import("../../../pages/Settings/Github/GithubToken"))
          .default,
        alertText:
          "GitHub OAuth is not configured. Add your GitHub Client ID in Settings > OAuth Credentials.",
      },
      {
        Component: (await import("../../../pages/Settings/Dropbox/DropboxToken"))
          .default,
        alertText:
          "Dropbox OAuth is not configured. Add your Dropbox Client ID in Settings > OAuth Credentials.",
      },
      {
        Component: (
          await import("../../../pages/Settings/GoogleDrive/GoogleDriveToken")
        ).default,
        alertText:
          "Google Drive OAuth is not configured. Add your Google Drive Client ID in Settings > OAuth Credentials.",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      (window as any).electron.readOauthConfig = vi.fn(async () => null);

      render(<item.Component />);

      fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(item.alertText);
      });
      expect((window as any).electron.startOAuthFlow).not.toHaveBeenCalled();
    }
  });

  it("alerts when the Firebase backend is not configured for the Electron flow", async () => {
    const cases = [
      {
        Component: (await import("../../../pages/Settings/Github/GithubToken"))
          .default,
      },
      {
        Component: (await import("../../../pages/Settings/Dropbox/DropboxToken"))
          .default,
      },
      {
        Component: (
          await import("../../../pages/Settings/GoogleDrive/GoogleDriveToken")
        ).default,
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "");
      (window as any).electron.readFirebaseConfig = vi.fn(async () => null);

      render(<item.Component />);

      fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(
          "Firebase backend is not configured. Set your Firebase credentials in Settings first.",
        );
      });
      expect((window as any).electron.startOAuthFlow).not.toHaveBeenCalled();
    }
  });
});
