import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChangePassword from "../../pages/Settings/ChangePassword";
import DeleteAccount from "../../pages/Settings/DeleteAccount";
import { auth } from "../../lib/firebase";
import { deleteUser, updatePassword } from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
  };
});

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
  })),
  updatePassword: vi.fn(),
  deleteUser: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  connectAuthEmulator: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null);
    return vi.fn();
  }),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((...segments: unknown[]) => segments.slice(1).join("/")),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));

function installLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  });
}

function getLastButton(name: string | RegExp) {
  const buttons = screen.getAllByRole("button", { name });
  return buttons[buttons.length - 1];
}

describe("Settings account actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorage();
    (auth as any).currentUser = { uid: "user-123", email: "user@test.dev" };
    vi.mocked(updatePassword).mockResolvedValue(undefined);
    vi.mocked(deleteDoc).mockResolvedValue(undefined);
    vi.mocked(deleteUser).mockResolvedValue(undefined);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    (auth as any).currentUser = null;
  });

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
});
