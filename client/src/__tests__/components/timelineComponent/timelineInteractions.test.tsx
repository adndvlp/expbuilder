import {
  installLocalStorage,
  mocks,
  renderTimeline,
  setClipboard,
} from "./testHarness";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Timeline component", () => {
  beforeEach(() => {
    installLocalStorage();
    vi.clearAllMocks();
    localStorage.clear();
    mocks.auth.currentUser = { uid: "user-1" };
    mocks.firebaseUser = { uid: "user-1" };
    mocks.initialExperimentUrl = "https://example.test/experiment";
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        googleDriveTokens: true,
        githubTokens: true,
      }),
    });
    setClipboard(vi.fn(async () => undefined));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("loads empty token state when the user document is missing", async () => {
    mocks.getDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => ({}),
    });

    renderTimeline();

    await waitFor(() => {
      expect(localStorage.getItem("userTokens_user-1")).toContain(
        '"github":false',
      );
    });
    expect(
      screen.getByRole("button", { name: "Publish to GitHub Pages" }),
    ).toBeDisabled();
  });

  it("falls back to empty token state when Firestore token loading fails", async () => {
    mocks.getDoc.mockRejectedValueOnce(new Error("firestore unavailable"));

    renderTimeline();

    await waitFor(() => {
      expect(mocks.getDoc).toHaveBeenCalled();
    });
    expect(
      screen.getByRole("button", { name: "Publish to GitHub Pages" }),
    ).toBeDisabled();
  });

  it("loads connected storage tokens from Firestore when no cache exists", async () => {
    renderTimeline();

    await waitFor(() => {
      expect(localStorage.getItem("userTokens_user-1")).toContain(
        '"github":true',
      );
    });
    expect(
      screen.getByRole("button", { name: "Publish to GitHub Pages" }),
    ).toBeEnabled();
  });

  it("keeps token state empty when auth reports no firebase user", async () => {
    mocks.firebaseUser = null;

    renderTimeline();

    expect(mocks.getDoc).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Publish to GitHub Pages" }),
    ).toBeDisabled();
  });

  it("uses cached tokens, opens URLs, shares tunnels, copies links and publishes with storage", async () => {
    localStorage.setItem(
      "userTokens_user-1",
      JSON.stringify({
        tokens: { drive: true, dropbox: false, osf: false, github: true },
        ts: Date.now(),
      }),
    );
    const clipboard = vi.fn(async () => undefined);
    setClipboard(clipboard);

    renderTimeline();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Publish to GitHub Pages" }),
      ).toBeEnabled();
    });
    expect(mocks.getDoc).not.toHaveBeenCalled();

    const runButton = screen.getByRole("button", { name: "Run experiment" });
    fireEvent.mouseEnter(runButton);
    fireEvent.mouseLeave(runButton);
    fireEvent.click(runButton);
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://example.test/experiment",
    );

    fireEvent.click(screen.getByRole("button", { name: "Build Experiment" }));
    await screen.findByText("success: built");

    fireEvent.click(
      screen.getByRole("button", { name: "Share Local Experiment" }),
    );
    await screen.findByText("Tunnel ready");
    expect(
      screen.getByRole("button", { name: "Close tunnel" }),
    ).toBeInTheDocument();

    const tunnelCopy = await screen.findByRole("button", {
      name: "Copy Tunnel Link",
    });
    fireEvent.mouseEnter(tunnelCopy);
    fireEvent.mouseLeave(tunnelCopy);
    fireEvent.click(tunnelCopy);
    await screen.findByText("Tunnel link copied!");
    expect(clipboard).toHaveBeenCalledWith("https://tunnel.test/exp-123");

    clipboard.mockRejectedValueOnce(new Error("copy failed"));
    fireEvent.click(tunnelCopy);
    await screen.findByText("Failed to copy.");

    fireEvent.click(
      screen.getByRole("button", { name: "Publish to GitHub Pages" }),
    );
    await screen.findByTestId("storage-modal");
    expect(screen.getByText("Ready to publish")).toBeInTheDocument();

    const pagesCopy = await screen.findByRole("button", {
      name: "Copy GitHub Pages Link",
    });
    fireEvent.mouseEnter(pagesCopy);
    fireEvent.mouseLeave(pagesCopy);
    clipboard.mockResolvedValueOnce(undefined);
    fireEvent.click(pagesCopy);
    await screen.findByText("GitHub Pages link copied!");

    clipboard.mockRejectedValueOnce(new Error("pages copy failed"));
    fireEvent.click(pagesCopy);
    await screen.findByText("Failed to copy.");

    await new Promise((resolve) => setTimeout(resolve, 2100));
    expect(screen.queryByText("Tunnel link copied!")).not.toBeInTheDocument();
    expect(
      screen.queryByText("GitHub Pages link copied!"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "confirm storage" }));
    await waitFor(() => {
      expect(mocks.publishWithStorageSpy).toHaveBeenCalledWith(
        "user-1",
        "googledrive",
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Publish to GitHub Pages" }),
    );
    await screen.findByTestId("storage-modal");
    fireEvent.click(screen.getByRole("button", { name: "cancel storage" }));
    expect(screen.queryByTestId("storage-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close tunnel" }));
    expect(await screen.findByText("Tunnel closed")).toBeInTheDocument();
  });

  it("does not publish selected storage when Firebase currentUser is absent", async () => {
    localStorage.setItem(
      "userTokens_user-1",
      JSON.stringify({
        tokens: { drive: true, dropbox: false, osf: false, github: true },
        ts: Date.now(),
      }),
    );
    mocks.auth.currentUser = null;

    renderTimeline();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Publish to GitHub Pages" }),
      ).toBeEnabled();
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Publish to GitHub Pages" }),
    );
    await screen.findByTestId("storage-modal");
    fireEvent.click(screen.getByRole("button", { name: "confirm storage" }));

    expect(mocks.publishWithStorageSpy).not.toHaveBeenCalled();
  });

  it("keeps run hover styling inert when no runnable URL exists", () => {
    mocks.initialExperimentUrl = "";
    renderTimeline();

    const runButton = screen.getByRole("button", { name: "Run experiment" });
    const initialBackground = runButton.style.backgroundColor;

    expect(runButton).toBeDisabled();
    const reactPropsKey = Object.keys(runButton).find((key) =>
      key.startsWith("__reactProps$"),
    );
    expect(reactPropsKey).toBeDefined();
    const reactProps = (
      runButton as unknown as Record<
        string,
        { onMouseEnter: (event: { currentTarget: HTMLElement }) => void }
      >
    )[reactPropsKey!];
    reactProps.onMouseEnter({ currentTarget: runButton });
    fireEvent.mouseLeave(runButton);

    expect(runButton.style.backgroundColor).toBe(initialBackground);
    expect(mocks.openExternal).not.toHaveBeenCalled();
  });
});
