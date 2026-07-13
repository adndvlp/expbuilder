import {
  docSnap,
  mocks,
  registerSettingsOAuthCallbackPagesHooks,
} from "./testHarness";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OsfCallback from "../../../pages/Settings/OsfCallback";

describe("Settings OAuth callback pages", () => {
  registerSettingsOAuthCallbackPagesHooks();

  it("verifies successful OSF callbacks before returning to Settings", async () => {
    vi.useFakeTimers();
    mocks.searchParams = new URLSearchParams({
      provider: "osf",
      success: "true",
    });
    mocks.getDoc.mockResolvedValue(
      docSnap({ osfTokens: { access_token: "ok" } }),
    );

    render(<OsfCallback />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Success!")).toBeInTheDocument();
    expect(screen.getByText("OSF connected successfully!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/settings?status=success&service=osf",
    );
  });

  it("reports OSF callback verification failures when the token is missing", async () => {
    vi.useFakeTimers();
    mocks.searchParams = new URLSearchParams({
      provider: "osf",
      success: "true",
    });
    mocks.getDoc.mockResolvedValue(docSnap({ osfTokens: null }));

    render(<OsfCallback />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText("Failed to verify OSF connection"),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/settings?status=error&service=osf&message=Verification failed",
    );
  });

  it("reports OSF verification failures without a user or Firestore document", async () => {
    vi.useFakeTimers();
    mocks.searchParams = new URLSearchParams({
      provider: "osf",
      success: "true",
    });
    mocks.auth.currentUser = null;

    const noUserView = render(<OsfCallback />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText("Failed to verify OSF connection"),
    ).toBeInTheDocument();
    expect(mocks.getDoc).not.toHaveBeenCalled();
    noUserView.unmount();

    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.getDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => ({}),
    });

    render(<OsfCallback />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText("Failed to verify OSF connection"),
    ).toBeInTheDocument();
    expect(mocks.getDoc).toHaveBeenCalledTimes(1);
  });
});
