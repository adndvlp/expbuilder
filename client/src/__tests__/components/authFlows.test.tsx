import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "../../pages/Auth/Login";
import Register from "../../pages/Auth/Register";
import ProtectedRoute from "../../components/ProtectedRoute";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth } from "../../lib/firebase";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
      <a href={to}>{children}</a>
    ),
    Navigate: ({
      to,
      replace,
    }: {
      to: string;
      replace?: boolean;
    }) => <div data-testid="navigate" data-to={to} data-replace={String(!!replace)} />,
  };
});

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null);
    return vi.fn();
  }),
  connectAuthEmulator: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((...segments: unknown[]) => segments.slice(1).join("/")),
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

function fillAuthForm(container: HTMLElement, values: string[]) {
  const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
  values.forEach((value, index) => {
    fireEvent.change(inputs[index], { target: { value } });
  });
}

describe("Auth flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorage();
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: { uid: "user-123", email: "user@test.dev" },
    } as any);
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({
      user: { uid: "user-456", email: "new@test.dev" },
    } as any);
    vi.mocked(setDoc).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("signs in, persists the Firebase user and navigates home", async () => {
    const { container } = render(<Login />);

    fillAuthForm(container, ["user@test.dev", "secret"]);
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        "user@test.dev",
        "secret",
      );
    });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "user",
      JSON.stringify({ uid: "user-123", email: "user@test.dev" }),
    );
    expect(routerMocks.navigate).toHaveBeenCalledWith("/home");
  });

  it("maps Firebase login errors to field messages", async () => {
    vi.mocked(signInWithEmailAndPassword)
      .mockRejectedValueOnce({ code: "auth/user-not-found" })
      .mockRejectedValueOnce({ code: "auth/wrong-password" });

    const { container, rerender } = render(<Login />);

    fillAuthForm(container, ["missing@test.dev", "secret"]);
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("User not found")).toBeInTheDocument();

    rerender(<Login />);
    fillAuthForm(container, ["user@test.dev", "bad-secret"]);
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Incorrect password")).toBeInTheDocument();
  });

  it("validates registration locally before creating a Firebase user", () => {
    const { container } = render(<Register />);

    fillAuthForm(container, ["new@test.dev", "short", "short"]);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(
      screen.getByText("Password must be at least 12 characters"),
    ).toBeInTheDocument();
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();

    fillAuthForm(container, [
      "new@test.dev",
      "long-enough-password",
      "different-password",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("creates a user document after successful registration", async () => {
    const { container } = render(<Register />);

    fillAuthForm(container, [
      "new@test.dev",
      "long-enough-password",
      "long-enough-password",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        "new@test.dev",
        "long-enough-password",
      );
    });
    expect(doc).toHaveBeenCalledWith({}, "users", "user-456");
    expect(setDoc).toHaveBeenCalledWith("users/user-456", {
      email: "new@test.dev",
      uid: "user-456",
      osfTokens: null,
      osfTokenValid: false,
      dropboxTokens: null,
      githubTokens: null,
      experiments: [],
    });
    expect(
      await screen.findByText("Account created! You can now log in."),
    ).toBeInTheDocument();
  });

  it("maps registration Firebase errors to field messages", async () => {
    vi.mocked(createUserWithEmailAndPassword)
      .mockRejectedValueOnce({ code: "auth/email-already-in-use" })
      .mockRejectedValueOnce({ code: "auth/weak-password" });

    const { container, rerender } = render(<Register />);

    fillAuthForm(container, [
      "taken@test.dev",
      "long-enough-password",
      "long-enough-password",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Email already in use")).toBeInTheDocument();

    rerender(<Register />);
    fillAuthForm(container, [
      "new@test.dev",
      "long-enough-password",
      "long-enough-password",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Password is too weak")).toBeInTheDocument();
  });

  it("renders protected children or redirects based on auth state", async () => {
    vi.mocked(onAuthStateChanged).mockImplementationOnce((_auth, callback) => {
      callback({ uid: "user-123" } as any);
      return vi.fn();
    });

    const { unmount } = render(
      <ProtectedRoute>
        <div>Private App</div>
      </ProtectedRoute>,
    );

    expect(await screen.findByText("Private App")).toBeInTheDocument();
    unmount();

    vi.mocked(onAuthStateChanged).mockImplementationOnce((_auth, callback) => {
      callback(null);
      return vi.fn();
    });
    render(
      <ProtectedRoute>
        <div>Private App</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("navigate")).toHaveAttribute(
        "data-to",
        "/auth/login",
      );
    });
    expect(screen.getByTestId("navigate")).toHaveAttribute(
      "data-replace",
      "true",
    );
  });
});
