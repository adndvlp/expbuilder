import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GoogleDriveToken from "../../pages/Settings/GoogleDrive/GoogleDriveToken";
import DropboxToken from "../../pages/Settings/Dropbox/DropboxToken";
import GithubToken from "../../pages/Settings/Github/GithubToken";
import OsfToken, {
  getOsfManageUrl,
  getOsfOAuthExchangeUrl,
  getOsfRedirectUri,
} from "../../pages/Settings/OsfToken";
import GoogleDriveCallback, {
  getGoogleDriveOAuthCallbackUrl,
} from "../../pages/Settings/GoogleDrive/GoogleDriveCallback";
import DropboxCallback, {
  getDropboxOAuthCallbackUrl,
} from "../../pages/Settings/Dropbox/DropboxCallback";
import GithubCallback, {
  getGithubOAuthCallbackUrl,
} from "../../pages/Settings/Github/GithubCallback";
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

async function fillOsfManualForm() {
  fireEvent.click(await screen.findByText("Use Personal Access Token instead"));
  fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
  fireEvent.change(screen.getByPlaceholderText("Parent Project ID (e.g., abc12)"), {
    target: { value: "abc12" },
  });
  fireEvent.change(screen.getByPlaceholderText("Paste your OSF token here"), {
    target: { value: "osf-token" },
  });
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
    vi.unstubAllEnvs();
    cleanup();
    mocks.auth.currentUser = null;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("builds OSF URLs for Electron, development and production", () => {
    expect(getOsfRedirectUri(true, true)).toBe(
      "http://localhost:8888/oauth/osf/callback",
    );
    expect(getOsfRedirectUri(false, true)).toBe(
      "http://localhost:5173/oauth/osf/callback",
    );
    expect(getOsfRedirectUri(false, false, "https://example.test/osf")).toBe(
      "https://example.test/osf",
    );
    expect(getOsfRedirectUri(false, false)).toBe(
      "https://us-central1-test-e4cf9.cloudfunctions.net/osfOAuthCallback",
    );
    expect(getOsfManageUrl(true)).toContain("127.0.0.1:5001");
    expect(getOsfManageUrl(false)).toBe(
      "https://us-central1-test-e4cf9.cloudfunctions.net/osfManage",
    );
    expect(
      getOsfOAuthExchangeUrl(true, "a b", "signed/state", "http://local/cb"),
    ).toBe(
      "http://127.0.0.1:5001/test-e4cf9/us-central1/osfOAuthCallback?code=a%20b&state=signed%2Fstate&redirect_uri=http%3A%2F%2Flocal%2Fcb",
    );
    expect(
      getOsfOAuthExchangeUrl(
        false,
        "code",
        "state",
        "https://app.test/callback",
      ),
    ).toContain(
      "https://us-central1-test-e4cf9.cloudfunctions.net/osfOAuthCallback",
    );
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

  it("shows Dropbox OAuth state failures without opening a provider window", async () => {
    mocks.fetchOAuthState.mockRejectedValueOnce(new Error("state unavailable"));

    render(<DropboxToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Could not start OAuth flow: state unavailable",
      );
    });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("shows Google Drive OAuth state failures without opening a provider window", async () => {
    mocks.fetchOAuthState.mockRejectedValueOnce(new Error("state unavailable"));

    render(<GoogleDriveToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Could not start OAuth flow: state unavailable",
      );
    });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders Google Drive disconnected state without a signed-in user and ignores connect clicks", async () => {
    mocks.auth.currentUser = null;

    render(<GoogleDriveToken />);

    expect(await screen.findByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(fetchOAuthState).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders Google Drive disconnected state when the user document is missing", async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });

    render(<GoogleDriveToken />);

    expect(await screen.findByText("Google Drive")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
  });

  it("renders Dropbox disconnected state without a signed-in user and ignores connect clicks", async () => {
    mocks.auth.currentUser = null;

    render(<DropboxToken />);

    expect(await screen.findByText("Dropbox")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(fetchOAuthState).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders Dropbox disconnected state when the user document is missing", async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });

    render(<DropboxToken />);

    expect(await screen.findByText("Dropbox")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
  });

  it("renders GitHub disconnected state without a signed-in user and ignores connect clicks", async () => {
    mocks.auth.currentUser = null;

    render(<GithubToken />);

    expect(await screen.findByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(fetchOAuthState).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders GitHub disconnected state when the user document is missing", async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });

    render(<GithubToken />);

    expect(await screen.findByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();
  });

  it("uses the production Dropbox callback URL outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");

    const { default: ProductionDropboxToken } = await import(
      "../../pages/Settings/Dropbox/DropboxToken"
    );
    render(<ProductionDropboxToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(openExternal).toHaveBeenCalled();
    });
    expect(lastOpenedUrl().searchParams.get("redirect_uri")).toBe(
      "https://test-e4cf9.firebaseapp.com/dropbox-callback",
    );
  });

  it("uses the production Google Drive callback URL outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");

    const { default: ProductionGoogleDriveToken } = await import(
      "../../pages/Settings/GoogleDrive/GoogleDriveToken"
    );
    render(<ProductionGoogleDriveToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(openExternal).toHaveBeenCalled();
    });
    expect(lastOpenedUrl().searchParams.get("redirect_uri")).toBe(
      "https://test-e4cf9.firebaseapp.com/google-drive-callback",
    );
  });

  it("uses the production GitHub callback URL outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");

    const { default: ProductionGithubToken } = await import(
      "../../pages/Settings/Github/GithubToken"
    );
    render(<ProductionGithubToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(openExternal).toHaveBeenCalled();
    });
    expect(lastOpenedUrl().searchParams.get("redirect_uri")).toBe(
      "https://test-e4cf9.firebaseapp.com/github-callback",
    );
  });

  it("logs provider token load failures and renders disconnected state", async () => {
    const cases = [
      { Component: GoogleDriveToken, provider: "Google Drive" },
      { Component: DropboxToken, provider: "Dropbox" },
      { Component: GithubToken, provider: "GitHub" },
      { Component: OsfToken, provider: "OSF (Open Science Framework)" },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockRejectedValue(new Error("load failed"));

      render(<item.Component />);

      expect(await screen.findByText(item.provider)).toBeInTheDocument();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error loading token status"),
        expect.any(Error),
      );
      expect(screen.getByText(/Not connected|Not Connected/)).toBeInTheDocument();
    }
  });

  it("logs Drive, Dropbox and GitHub disconnect failures without clearing the token", async () => {
    const cases = [
      {
        Component: GoogleDriveToken,
        tokenData: { googleDriveTokens: { access_token: "drive-token" } },
        logPrefix: "Error deleting Google Drive token:",
      },
      {
        Component: DropboxToken,
        tokenData: { dropboxTokens: { access_token: "dropbox-token" } },
        logPrefix: "Error deleting Dropbox token:",
      },
      {
        Component: GithubToken,
        tokenData: { githubTokens: { access_token: "github-token" } },
        logPrefix: "Error deleting GitHub token:",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockResolvedValue(docSnap(item.tokenData));
      mocks.updateDoc.mockRejectedValue(new Error("disconnect failed"));

      render(<item.Component />);

      expect(await screen.findByText(/Connected/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          item.logPrefix,
          expect.any(Error),
        );
      });
      expect(screen.getByText(/Connected/)).toBeInTheDocument();
    }
  });

  it("shows OSF OAuth state errors inline without opening a provider window", async () => {
    mocks.fetchOAuthState.mockRejectedValueOnce(new Error("state unavailable"));

    render(<OsfToken />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    expect(
      await screen.findByText("Could not start OAuth flow: state unavailable"),
    ).toBeInTheDocument();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders OSF disconnected state without a signed-in user and ignores OAuth clicks", async () => {
    mocks.auth.currentUser = null;

    render(<OsfToken />);

    expect(await screen.findByText(/Not Connected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Connect with OSF OAuth/ }));

    expect(fetchOAuthState).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("handles a missing OSF document and a valid manual token", async () => {
    mocks.getDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => ({}),
    });
    const missingView = render(<OsfToken />);

    expect(await screen.findByText(/Not Connected/)).toBeInTheDocument();
    missingView.unmount();

    mocks.getDoc.mockResolvedValueOnce(
      docSnap({ osfToken: "manual-token", osfTokenValid: true }),
    );
    render(<OsfToken />);

    expect(await screen.findByText(/Connected/)).toBeInTheDocument();
  });

  it("validates empty OSF manual tokens before saving", async () => {
    render(<OsfToken />);

    fireEvent.click(await screen.findByText("Use Personal Access Token instead"));
    fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
    fireEvent.change(screen.getByPlaceholderText("Parent Project ID (e.g., abc12)"), {
      target: { value: "abc12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(await screen.findAllByText("Please enter a valid token")).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows OSF manual token save failures and clears the manual form on cancel", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okJson({ success: false, message: "Token rejected" }),
    );

    render(<OsfToken />);

    fireEvent.click(await screen.findByText("Use Personal Access Token instead"));
    fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
    fireEvent.change(screen.getByPlaceholderText("Parent Project ID (e.g., abc12)"), {
      target: { value: "abc12" },
    });
    fireEvent.change(screen.getByPlaceholderText("Paste your OSF token here"), {
      target: { value: "bad-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(await screen.findAllByText("Token rejected")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Paste your OSF token here")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Use Personal Access Token instead"));
    fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
    expect(screen.getByPlaceholderText("Parent Project ID (e.g., abc12)")).toHaveValue("");
    expect(screen.getByPlaceholderText("Paste your OSF token here")).toHaveValue("");
  });

  it("surfaces OSF manual save exceptions", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));

    render(<OsfToken />);

    fireEvent.click(await screen.findByText("Use Personal Access Token instead"));
    fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
    fireEvent.change(screen.getByPlaceholderText("Parent Project ID (e.g., abc12)"), {
      target: { value: "abc12" },
    });
    fireEvent.change(screen.getByPlaceholderText("Paste your OSF token here"), {
      target: { value: "osf-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(await screen.findAllByText("network down")).toHaveLength(2);
    expect(console.error).toHaveBeenCalledWith(
      "Error saving OSF token:",
      expect.any(Error),
    );
  });

  it("uses OSF manual-save defaults for sparse responses and thrown values", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okJson({ success: false }));
    const failureView = render(<OsfToken />);
    await fillOsfManualForm();
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(await screen.findAllByText("Failed to save token")).toHaveLength(2);
    failureView.unmount();

    mocks.getDoc.mockResolvedValue(docSnap({}));
    vi.mocked(fetch).mockResolvedValueOnce(okJson({ success: true }));
    const successView = render(<OsfToken />);
    await fillOsfManualForm();
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(await screen.findByText(/Connected/)).toBeInTheDocument();
    successView.unmount();

    mocks.getDoc.mockResolvedValue(docSnap({}));
    vi.mocked(fetch).mockRejectedValueOnce("offline");
    render(<OsfToken />);
    await fillOsfManualForm();
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(await screen.findAllByText("Error saving token")).toHaveLength(2);
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

  it("cancels OSF disconnects and reports disconnect failures", async () => {
    mocks.getDoc.mockResolvedValue(
      docSnap({
        osfTokens: { access_token: "osf-oauth-token" },
        osfUserName: "OSF User",
        osfProjectId: "abc12",
      }),
    );
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    render(<OsfToken />);

    expect(await screen.findByText(/OSF User/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(fetch).not.toHaveBeenCalled();

    cleanup();
    vi.clearAllMocks();
    mocks.getDoc.mockResolvedValue(
      docSnap({
        osfTokens: { access_token: "osf-oauth-token" },
        osfUserName: "OSF User",
        osfProjectId: "abc12",
      }),
    );
    vi.mocked(window.confirm).mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValueOnce(
      okJson({ success: false, message: "Cannot disconnect" }),
    );

    render(<OsfToken />);

    expect(await screen.findByText(/OSF User/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Error: Cannot disconnect");
    });
    expect(console.error).toHaveBeenCalledWith(
      "Error deleting OSF token:",
      expect.any(Error),
    );
  });

  it("uses OSF disconnect defaults for sparse responses and thrown values", async () => {
    const connectedDoc = docSnap({
      osfTokens: { access_token: "osf-oauth-token" },
    });
    mocks.getDoc.mockResolvedValue(connectedDoc);
    vi.mocked(fetch).mockResolvedValueOnce(okJson({ success: false }));
    const responseFailureView = render(<OsfToken />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Disconnect" }),
    );
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Error: Failed to disconnect",
      );
    });
    responseFailureView.unmount();

    mocks.getDoc.mockResolvedValue(connectedDoc);
    vi.mocked(fetch).mockRejectedValueOnce("offline");
    render(<OsfToken />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Disconnect" }),
    );
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Error: Error disconnecting OSF",
      );
    });
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

  it("builds deployed callback URLs for all providers", () => {
    expect(getGoogleDriveOAuthCallbackUrl(false, "a b", "signed/state")).toBe(
      "https://us-central1-test-e4cf9.cloudfunctions.net/googleDriveOAuthCallback?code=a%20b&state=signed%2Fstate",
    );
    expect(getDropboxOAuthCallbackUrl(false, "a b", "signed/state")).toBe(
      "https://us-central1-test-e4cf9.cloudfunctions.net/dropboxOAuthCallback?code=a%20b&state=signed%2Fstate",
    );
    expect(getGithubOAuthCallbackUrl(false, "a b", "signed/state")).toBe(
      "https://us-central1-test-e4cf9.cloudfunctions.net/githubOAuthCallback?code=a%20b&state=signed%2Fstate",
    );
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

  it("routes Drive and Dropbox callback errors back to Settings", async () => {
    const cases = [
      {
        Component: GoogleDriveCallback,
        service: "google-drive",
      },
      {
        Component: DropboxCallback,
        service: "dropbox",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.searchParams = new URLSearchParams({ error: "access denied" });

      render(<item.Component />);

      await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith(
          `/settings?status=error&service=${item.service}&message=access%20denied`,
        );
      });
    }
  });

  it("routes missing OAuth callback parameters back to Settings", async () => {
    const cases = [
      {
        Component: GoogleDriveCallback,
        service: "google-drive",
      },
      {
        Component: DropboxCallback,
        service: "dropbox",
      },
      {
        Component: GithubCallback,
        service: "github",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      mocks.searchParams = new URLSearchParams({ code: "only-code" });

      render(<item.Component />);

      await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith(
          `/settings?status=error&service=${item.service}&message=Missing parameters`,
        );
      });
    }
  });

  it("routes redirect assignment failures back to Settings", async () => {
    const cases = [
      {
        Component: GoogleDriveCallback,
        service: "google-drive",
      },
      {
        Component: DropboxCallback,
        service: "dropbox",
      },
      {
        Component: GithubCallback,
        service: "github",
      },
    ] as const;

    for (const item of cases) {
      cleanup();
      vi.clearAllMocks();
      const throwingLocation = {};
      Object.defineProperty(throwingLocation, "href", {
        configurable: true,
        get: () => "http://localhost/",
        set: () => {
          throw new Error("redirect blocked");
        },
      });
      Object.defineProperty(window, "location", {
        configurable: true,
        value: throwingLocation,
      });
      mocks.searchParams = new URLSearchParams({
        code: "code",
        state: "state",
      });

      render(<item.Component />);

      await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith(
          `/settings?status=error&service=${item.service}&message=redirect%20blocked`,
        );
      });
    }
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
