import { mocks, registerSettingsOAuthCallbackPagesHooks } from "./testHarness";
import { act, cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OsfCallback from "../../../pages/Settings/OsfCallback";

describe("Settings OAuth callback pages", () => {
  registerSettingsOAuthCallbackPagesHooks();

  it("handles invalid OSF callback parameters and redirects back to Settings", async () => {
    vi.useFakeTimers();
    mocks.searchParams = new URLSearchParams();

    render(<OsfCallback />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Invalid callback parameters")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mocks.navigate).toHaveBeenCalledWith("/settings");
  });

  it("handles OSF access denial and generic callback errors", async () => {
    vi.useFakeTimers();
    mocks.searchParams = new URLSearchParams({
      provider: "osf",
      error: "access_denied",
    });

    render(<OsfCallback />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Access denied by user")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/settings?status=error&service=osf&message=Access denied",
    );

    cleanup();
    vi.clearAllMocks();
    mocks.searchParams = new URLSearchParams({
      provider: "osf",
      error: "server error",
    });

    render(<OsfCallback />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Error: server error")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/settings?status=error&service=osf&message=server%20error",
    );
  });

  it("handles invalid OSF callback state and token verification exceptions", async () => {
    vi.useFakeTimers();
    mocks.searchParams = new URLSearchParams({ provider: "osf" });

    render(<OsfCallback />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Invalid callback state")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mocks.navigate).toHaveBeenCalledWith("/settings");

    cleanup();
    vi.clearAllMocks();
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.searchParams = new URLSearchParams({
      provider: "osf",
      success: "true",
    });
    mocks.getDoc.mockRejectedValue(new Error("firestore unavailable"));

    render(<OsfCallback />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText("Failed to verify OSF connection"),
    ).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(
      "Error verifying OSF tokens:",
      expect.any(Error),
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/settings?status=error&service=osf&message=Verification failed",
    );
  });
});
