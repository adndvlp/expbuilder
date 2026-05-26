import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GoogleDriveToken from "../../pages/Settings/GoogleDrive/GoogleDriveToken";
import DropboxToken from "../../pages/Settings/Dropbox/DropboxToken";
import GithubToken from "../../pages/Settings/Github/GithubToken";
import OsfToken from "../../pages/Settings/OsfToken";
import GoogleDriveCallback from "../../pages/Settings/GoogleDrive/GoogleDriveCallback";
import DropboxCallback from "../../pages/Settings/Dropbox/DropboxCallback";
import GithubCallback from "../../pages/Settings/Github/GithubCallback";
import OsfCallback from "../../pages/Settings/OsfCallback";
import { doc, updateDoc } from "firebase/firestore";
import { fetchOAuthState } from "../../lib/oauthState";
import { openExternal } from "../../lib/openExternal";

const mocks = vi.hoisted(() => ({
  auth: {
    currentUser: null as null | { uid: string; email?: string },
    signOut: vi.fn(),
  },
  db: {},
  doc: vi.fn((...segments: unknown[]) => segments.slice(1).join("/")),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  fetchOAuthState: vi.fn(),
  openExternal: vi.fn(),
  navigate: vi.fn(),
  searchParams: new URLSearchParams(),
  setSearchParams: vi.fn(),
}));

vi.mock("../../lib/firebase", () => ({
  auth: mocks.auth,
  db: mocks.db,
  app: { name: "test-app" },
  getFirebaseAuth: vi.fn(async () => mocks.auth),
  getFirebaseDb: vi.fn(async () => mocks.db),
  getFirebaseApp: vi.fn(async () => ({ name: "test-app" })),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => mocks.auth),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(mocks.auth.currentUser);
    return vi.fn();
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => mocks.db),
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  updateDoc: mocks.updateDoc,
  setDoc: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock("../../lib/oauthState", () => ({
  fetchOAuthState: mocks.fetchOAuthState,
}));

vi.mock("../../lib/openExternal", () => ({
  openExternal: mocks.openExternal,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [mocks.searchParams, mocks.setSearchParams],
  };
});

function docSnap(data: Record<string, unknown> = {}) {
  return {
    exists: () => true,
    data: () => data,
  };
}

function okJson(payload: unknown, ok = true): Response {
  return {
    ok,
    redirected: false,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function lastOpenedUrl(): URL {
  const rawUrl = vi.mocked(openExternal).mock.calls.at(-1)?.[0];
  expect(rawUrl).toBeTruthy();
  return new URL(rawUrl as string);
}

const originalLocation = window.location;

function stubLocation() {
  const location = { href: "http://localhost/" };
  Object.defineProperty(window, "location", {
    configurable: true,
    value: location,
  });
  return location;
}

describe("Settings OAuth tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    delete (window as any).electron;
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.searchParams = new URLSearchParams();
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.updateDoc.mockResolvedValue(undefined);
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ success: true })));
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
    mocks.auth.currentUser = null;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("opens provider OAuth URLs with backend-signed state instead of uid state", async () => {
    const cases = [
      {
        Component: GoogleDriveToken,
        provider: "googledrive",
        origin: "https://accounts.google.com",
        pathname: "/o/oauth2/v2/auth",
        redirectUri: "http://localhost:5173/google-drive-callback",
      },
      {
        Component: DropboxToken,
        provider: "dropbox",
        origin: "https://www.dropbox.com",
        pathname: "/oauth2/authorize",
        redirectUri: "http://localhost:5173/dropbox-callback",
      },
      {
        Component: GithubToken,
        provider: "github",
        origin: "https://github.com",
        pathname: "/login/oauth/authorize",
        redirectUri: "http://localhost:5173/github-callback",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
      mocks.getDoc.mockResolvedValue(docSnap({}));

      render(<item.Component />);

      fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(fetchOAuthState).toHaveBeenCalledWith(item.provider);
        expect(openExternal).toHaveBeenCalled();
      });

      const url = lastOpenedUrl();
      expect(url.origin).toBe(item.origin);
      expect(url.pathname).toBe(item.pathname);
      expect(url.searchParams.get("state")).toBe("signed-state-123");
      expect(url.searchParams.get("state")).not.toBe("user-123");
      expect(url.searchParams.get("redirect_uri")).toBe(item.redirectUri);
    }
  });

  it("disconnects stored Drive, Dropbox and GitHub tokens from the user doc", async () => {
    const cases = [
      {
        Component: GoogleDriveToken,
        tokenData: { googleDriveTokens: { access_token: "drive-token" } },
        clearedField: "googleDriveTokens",
      },
      {
        Component: DropboxToken,
        tokenData: { dropboxTokens: { access_token: "dropbox-token" } },
        clearedField: "dropboxTokens",
      },
      {
        Component: GithubToken,
        tokenData: { githubTokens: { access_token: "github-token" } },
        clearedField: "githubTokens",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockResolvedValue(docSnap(item.tokenData));
      mocks.updateDoc.mockResolvedValue(undefined);

      render(<item.Component />);

      expect(await screen.findByText(/Connected/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

      await waitFor(() => {
        expect(doc).toHaveBeenCalledWith(mocks.db, "users", "user-123");
        expect(updateDoc).toHaveBeenCalledWith(
          "users/user-123",
          expect.objectContaining({
            [item.clearedField]: null,
            uid: "user-123",
          }),
        );
      });
    }
  });

  it("shows OAuth state failures without opening a provider window", async () => {
    mocks.fetchOAuthState.mockRejectedValueOnce(new Error("state unavailable"));

    render(<GithubToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Could not start OAuth flow: state unavailable",
      );
    });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("saves a manual OSF token through osfManage and updates connected state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okJson({ success: true, userName: "OSF User" }),
    );

    render(<OsfToken />);

    fireEvent.click(await screen.findByText("Use Personal Access Token instead"));
    fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
    fireEvent.change(screen.getByPlaceholderText("Paste your OSF token here"), {
      target: { value: "osf-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(
      await screen.findAllByText("Please enter a valid OSF Project ID"),
    ).toHaveLength(2);

    fireEvent.change(screen.getByPlaceholderText("Parent Project ID (e.g., abc12)"), {
      target: { value: "abc12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:5001/test-e4cf9/us-central1/osfManage",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            action: "saveToken",
            uid: "user-123",
            token: "osf-token",
            projectId: "abc12",
          }),
        }),
      );
    });
    expect(await screen.findByText(/Connected/)).toBeInTheDocument();
    expect(window.alert).toHaveBeenCalledWith("OSF token saved successfully!");
  });

  it("opens OSF OAuth with signed state and disconnects through osfManage", async () => {
    render(<OsfToken />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    await waitFor(() => {
      expect(fetchOAuthState).toHaveBeenCalledWith("osf");
      expect(openExternal).toHaveBeenCalled();
    });
    const url = lastOpenedUrl();
    expect(url.origin).toBe("https://accounts.osf.io");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("state")).toBe("signed-state-123");
    expect(url.searchParams.get("state")).not.toBe("user-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:5173/oauth/osf/callback",
    );

    cleanup();
    vi.clearAllMocks();
    mocks.getDoc.mockResolvedValue(
      docSnap({
        osfTokens: { access_token: "osf-oauth-token" },
        osfUserName: "OSF User",
        osfProjectId: "abc12",
      }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(okJson({ success: true }));

    render(<OsfToken />);

    expect(await screen.findByText(/OSF User/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:5001/test-e4cf9/us-central1/osfManage",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            action: "disconnect",
            uid: "user-123",
          }),
        }),
      );
    });
    expect(window.alert).toHaveBeenCalledWith("OSF disconnected successfully!");

  });
});

describe("Settings OAuth callback pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.searchParams = new URLSearchParams();
    mocks.getDoc.mockResolvedValue(docSnap({ osfTokens: { access_token: "ok" } }));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("redirects Drive, Dropbox and GitHub callback codes to their Cloud Functions", async () => {
    const cases = [
      {
        Component: GoogleDriveCallback,
        title: "Connecting Google Drive...",
        endpoint: "googleDriveOAuthCallback",
      },
      {
        Component: DropboxCallback,
        title: "Connecting Dropbox...",
        endpoint: "dropboxOAuthCallback",
      },
      {
        Component: GithubCallback,
        title: "Connecting GitHub...",
        endpoint: "githubOAuthCallback",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      const location = stubLocation();
      mocks.searchParams = new URLSearchParams({
        code: "code value",
        state: "signed/state",
      });

      render(<item.Component />);

      expect(await screen.findByText(item.title)).toBeInTheDocument();
      await waitFor(() => {
        expect(location.href).toContain(item.endpoint);
        expect(location.href).toContain("code=code%20value");
        expect(location.href).toContain("state=signed%2Fstate");
      });
      expect(mocks.navigate).not.toHaveBeenCalled();
    }
  });

  it("routes provider callback errors back to Settings with service metadata", async () => {
    mocks.searchParams = new URLSearchParams({ error: "access_denied" });

    render(<GithubCallback />);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/settings?status=error&service=github&message=access_denied",
      );
    });
  });

  it("verifies successful OSF callbacks before returning to Settings", async () => {
    vi.useFakeTimers();
    mocks.searchParams = new URLSearchParams({
      provider: "osf",
      success: "true",
    });
    mocks.getDoc.mockResolvedValue(docSnap({ osfTokens: { access_token: "ok" } }));

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
});
