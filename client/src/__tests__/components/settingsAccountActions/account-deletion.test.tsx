import {
  getLastButton,
  registerSettingsAccountActionsHooks,
  routerMocks,
} from "./testHarness";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeleteAccount from "../../../pages/Settings/DeleteAccount";
import { auth } from "../../../lib/firebase";
import { deleteUser } from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";

describe("Settings account actions", () => {
  registerSettingsAccountActionsHooks();

  it("deletes the Firestore user doc, Firebase user and local user cache", async () => {
    localStorage.setItem("user", "cached-user");

    render(<DeleteAccount />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();

    fireEvent.click(getLastButton("Delete Account"));

    await waitFor(() => {
      expect(doc).toHaveBeenCalledWith({}, "users", "user-123");
      expect(deleteDoc).toHaveBeenCalledWith("users/user-123");
      expect(deleteUser).toHaveBeenCalledWith({
        uid: "user-123",
        email: "user@test.dev",
      });
    });
    expect(localStorage.removeItem).toHaveBeenCalledWith("user");
    expect(routerMocks.navigate).toHaveBeenCalledWith("/auth/login");
  });

  it("closes the delete modal from cancel, close and overlay actions", () => {
    render(<DeleteAccount />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    const modalContent = screen
      .getByText("Are you sure?")
      .closest(".modal-content")!;
    fireEvent.click(modalContent);
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    fireEvent.click(screen.getByText("×"));
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    fireEvent.click(
      screen.getByText("Are you sure?").closest(".modal-overlay")!,
    );
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
  });

  it("does not call delete APIs when there is no current user", async () => {
    (auth as any).currentUser = null;

    render(<DeleteAccount />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    fireEvent.click(getLastButton("Delete Account"));

    await waitFor(() => {
      expect(deleteDoc).not.toHaveBeenCalled();
      expect(deleteUser).not.toHaveBeenCalled();
    });
    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it("keeps the delete modal open and explains recent-login failures", async () => {
    vi.mocked(deleteUser).mockRejectedValueOnce({
      code: "auth/requires-recent-login",
    });

    render(<DeleteAccount />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    await act(async () => {
      fireEvent.click(getLastButton("Delete Account"));
    });

    expect(window.alert).toHaveBeenCalledWith(
      "Please log out and log in again to delete your account.",
    );
    expect(routerMocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("shows a generic alert when account deletion fails for another reason", async () => {
    vi.mocked(deleteDoc).mockRejectedValueOnce(new Error("firestore failed"));

    render(<DeleteAccount />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    await act(async () => {
      fireEvent.click(getLastButton("Delete Account"));
    });

    expect(window.alert).toHaveBeenCalledWith(
      "Failed to delete account. Please try again.",
    );
    expect(routerMocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });
});
