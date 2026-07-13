import { registerSettingsOAuthElectronFlowsHooks } from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
