import {
  docSnap,
  loadProviderTokens,
  mocks,
  okResponse,
  registerSettingsOAuthElectronFlowsHooks,
} from "./testHarness";
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

  it("exchanges Drive, Dropbox and GitHub Electron OAuth codes", async () => {
    for (const item of await loadProviderTokens()) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockResolvedValue(docSnap({}));
      mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
      vi.mocked(fetch).mockResolvedValue(okResponse(true));
      (window as any).electron.startOAuthFlow.mockResolvedValue({
        success: true,
        code: `${item.providerArg}-code`,
        state: "signed-state-123",
      });

      render(<item.Component />);

      fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect((window as any).electron.startOAuthFlow).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: item.providerArg,
            state: "signed-state-123",
          }),
        );
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(item.endpoint),
        );
      });

      const url = vi.mocked(fetch).mock.calls.at(-1)?.[0] as string;
      expect(url).toContain("code=");
      expect(url).toContain("state=signed-state-123");
      expect(url).toContain(
        `redirect_uri=${encodeURIComponent("http://localhost:8888/callback")}`,
      );
      expect(window.alert).toHaveBeenCalledWith(item.successAlert);
      expect(await screen.findByText(/Connected/)).toBeInTheDocument();
    }
  });

  it("reports Drive, Dropbox and GitHub Electron OAuth failures", async () => {
    for (const item of await loadProviderTokens()) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockResolvedValue(docSnap({}));
      mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
      (window as any).electron.startOAuthFlow.mockResolvedValue({
        success: false,
        error: "denied",
      });

      render(<item.Component />);

      fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith("Error: denied");
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error connecting"),
        expect.any(Error),
      );
    }
  });

  it("reports provider exchange failures after Electron returns a code", async () => {
    for (const item of await loadProviderTokens()) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockResolvedValue(docSnap({}));
      mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
      vi.mocked(fetch).mockResolvedValue(okResponse(false));
      (window as any).electron.startOAuthFlow.mockResolvedValue({
        success: true,
        code: "auth-code",
        state: "signed-state-123",
      });

      render(<item.Component />);

      fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(
          "Error: Failed to exchange tokens",
        );
      });
    }
  });

  it("uses the production Dropbox Cloud Function URL in Electron outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
    vi.mocked(fetch).mockResolvedValue(okResponse(true));
    (window as any).electron.startOAuthFlow.mockResolvedValue({
      success: true,
      code: "dropbox-code",
      state: "signed-state-123",
    });

    const { default: ProductionDropboxToken } = await import(
      "../../../pages/Settings/Dropbox/DropboxToken"
    );
    render(<ProductionDropboxToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://us-central1-test-e4cf9.cloudfunctions.net/dropboxOAuthCallback",
        ),
      );
    });
  });

  it("uses the production Google Drive Cloud Function URL in Electron outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
    vi.mocked(fetch).mockResolvedValue(okResponse(true));
    (window as any).electron.startOAuthFlow.mockResolvedValue({
      success: true,
      code: "drive-code",
      state: "signed-state-123",
    });

    const { default: ProductionGoogleDriveToken } = await import(
      "../../../pages/Settings/GoogleDrive/GoogleDriveToken"
    );
    render(<ProductionGoogleDriveToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://us-central1-test-e4cf9.cloudfunctions.net/googleDriveOAuthCallback",
        ),
      );
    });
  });

  it("uses the production GitHub Cloud Function URL in Electron outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
    vi.mocked(fetch).mockResolvedValue(okResponse(true));
    (window as any).electron.startOAuthFlow.mockResolvedValue({
      success: true,
      code: "github-code",
      state: "signed-state-123",
    });

    const { default: ProductionGithubToken } = await import(
      "../../../pages/Settings/Github/GithubToken"
    );
    render(<ProductionGithubToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://us-central1-test-e4cf9.cloudfunctions.net/githubOAuthCallback",
        ),
      );
    });
  });
});
