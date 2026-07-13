import {
  getLastButton,
  registerSettingsAccountActionsHooks,
} from "./testHarness";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChangePassword from "../../../pages/Settings/ChangePassword";
import { updatePassword } from "firebase/auth";

describe("Settings account actions", () => {
  registerSettingsAccountActionsHooks();

  it("validates password length and mismatch before changing the password", async () => {
    render(<ChangePassword />);

    fireEvent.click(screen.getByText("Change Password"));
    const submit = getLastButton("Change Password");

    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "abc" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "abcd" },
    });

    expect(
      screen.getByText("Password must be at least 6 characters"),
    ).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(submit).toBeDisabled();
    expect(updatePassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "secret1" },
    });

    fireEvent.click(submit);

    await waitFor(() => {
      expect(updatePassword).toHaveBeenCalledWith(
        { uid: "user-123", email: "user@test.dev" },
        "secret1",
      );
    });
    expect(
      await screen.findByText("Password changed successfully!"),
    ).toBeInTheDocument();
  });

  it("surfaces recent-login errors when changing password fails", async () => {
    vi.mocked(updatePassword).mockRejectedValueOnce({
      code: "auth/requires-recent-login",
    });

    render(<ChangePassword />);

    fireEvent.click(screen.getByText("Change Password"));
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "secret1" },
    });
    fireEvent.click(getLastButton("Change Password"));

    expect(
      await screen.findByText(
        "Please log out and log in again to change your password.",
      ),
    ).toBeInTheDocument();
  });

  it("closes the change password modal after a successful timeout", async () => {
    vi.useFakeTimers();
    render(<ChangePassword />);

    fireEvent.click(screen.getByText("Change Password"));
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "secret1" },
    });

    await act(async () => {
      fireEvent.click(getLastButton("Change Password"));
      await Promise.resolve();
    });

    expect(
      screen.getByText("Password changed successfully!"),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();
  });

  it("closes the change password modal from close and overlay actions", () => {
    render(<ChangePassword />);

    fireEvent.click(screen.getByText("Change Password"));
    const modalContent = screen
      .getByLabelText("New Password")
      .closest(".modal-content")!;
    fireEvent.click(modalContent);
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();

    fireEvent.click(screen.getByText("×"));
    expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Change Password"));
    fireEvent.click(
      screen.getByLabelText("New Password").closest(".modal-overlay")!,
    );
    expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();
  });

  it("surfaces generic change password failures", async () => {
    vi.mocked(updatePassword).mockRejectedValueOnce(
      new Error("network failed"),
    );

    render(<ChangePassword />);

    fireEvent.click(screen.getByText("Change Password"));
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "secret1" },
    });
    fireEvent.click(getLastButton("Change Password"));

    expect(
      await screen.findByText("Failed to change password. Please try again."),
    ).toBeInTheDocument();
  });
});
