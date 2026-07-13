import {
  fetchMock,
  mocks,
  okJson,
  registerSettingsShellHooks,
} from "./testHarness";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Settings from "../../../pages/Settings";
import { auth } from "../../../lib/firebase";

describe("Settings shell", () => {
  registerSettingsShellHooks();

  it("renders account settings for logged-in users and logs out", async () => {
    render(<Settings />);

    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(screen.getByText(/user@test.dev/)).toBeInTheDocument();
    expect(screen.getByText(/user-123/)).toBeInTheDocument();
    expect(screen.getByTestId("google-drive-token")).toBeInTheDocument();
    expect(screen.getByTestId("firebase-credentials")).toBeInTheDocument();
    expect(screen.queryByText(/You need an account/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(auth.signOut).toHaveBeenCalled();
    });
    expect(localStorage.removeItem).toHaveBeenCalledWith("user");
  });

  it("shows the logged-out overlay and routes users to login", async () => {
    mocks.authUser = null;

    render(<Settings />);

    expect(
      await screen.findByText("You need an account to access these settings."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("reset-app")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Go to Login"));

    expect(mocks.navigate).toHaveBeenCalledWith("/auth/login");
  });

  it("keeps settings usable when loading experiments fails", async () => {
    fetchMock().mockRejectedValueOnce(new Error("load failed"));

    render(<Settings />);

    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Export all")).toBeDisabled();
    expect(screen.getByText("Export selected...")).toBeDisabled();
  });

  it("defaults a sparse experiment-list response to an empty list", async () => {
    fetchMock().mockResolvedValueOnce(okJson({}));

    render(<Settings />);

    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Export all")).toBeDisabled();
  });

  it("shows OAuth callback notifications and clears query params", async () => {
    mocks.searchParams = new URLSearchParams({
      status: "success",
      service: "github",
    });

    render(<Settings />);

    expect(
      await screen.findByText("Github connected successfully!"),
    ).toBeInTheDocument();
    expect(mocks.setSearchParams).toHaveBeenCalledWith({});
  });

  it("shows OAuth error notifications, closes them, and clears the auto-hide timer", () => {
    vi.useFakeTimers();
    mocks.searchParams = new URLSearchParams({
      status: "error",
      service: "dropbox",
      message: "denied",
    });

    render(<Settings />);

    expect(
      screen.getByText("Error connecting dropbox: denied"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));
    expect(
      screen.queryByText("Error connecting dropbox: denied"),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
  });

  it("uses the OAuth error fallback and ignores unknown callback statuses", () => {
    mocks.searchParams = new URLSearchParams({
      status: "error",
      service: "osf",
    });
    const errorView = render(<Settings />);

    expect(
      screen.getByText("Error connecting osf: Unknown error"),
    ).toBeInTheDocument();
    errorView.unmount();

    mocks.searchParams = new URLSearchParams({
      status: "pending",
      service: "github",
    });
    render(<Settings />);

    expect(
      screen.queryByText(/connected successfully/),
    ).not.toBeInTheDocument();
    expect(mocks.setSearchParams).toHaveBeenCalledWith({});
  });

  it("navigates back and reports logout failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (auth as any).signOut = vi.fn(async () => {
      throw new Error("logout failed");
    });

    render(<Settings />);

    await screen.findByText("Settings");
    fireEvent.click(screen.getByText("←"));
    expect(mocks.navigate).toHaveBeenCalledWith(-1);

    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error logging out:",
        expect.any(Error),
      );
    });
  });
});
