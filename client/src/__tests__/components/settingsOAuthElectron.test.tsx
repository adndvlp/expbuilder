import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    currentUser: { uid: "user-123", email: "user@test.dev" } as null | {
      uid: string;
      email?: string;
    },
  },
  db: {},
  doc: vi.fn((...segments: unknown[]) => segments.slice(1).join("/")),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  fetchOAuthState: vi.fn(),
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

function docSnap(data: Record<string, unknown> = {}) {
  return {
    exists: () => true,
    data: () => data,
  };
}

function okResponse(ok = true, redirected = false): Response {
  return {
    ok,
    redirected,
    json: vi.fn(async () => ({ success: ok })),
  } as unknown as Response;
}

async function loadProviderTokens() {
  const [{ default: GoogleDriveToken }, { default: DropboxToken }, { default: GithubToken }] =
    await Promise.all([
      import("../../pages/Settings/GoogleDrive/GoogleDriveToken"),
      import("../../pages/Settings/Dropbox/DropboxToken"),
      import("../../pages/Settings/Github/GithubToken"),
    ]);

  return [
    {
      Component: GoogleDriveToken,
      providerArg: "google-drive",
      endpoint: "googleDriveOAuthCallback",
      successAlert: "Google Drive connected successfully!",
    },
    {
      Component: DropboxToken,
      providerArg: "dropbox",
      endpoint: "dropboxOAuthCallback",
      successAlert: "Dropbox connected successfully!",
    },
    {
      Component: GithubToken,
      providerArg: "github",
      endpoint: "githubOAuthCallback",
      successAlert: "GitHub connected successfully!",
    },
  ] as const;
}

describe("Settings OAuth Electron flows", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(true)));
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    (window as any).electron = {
      startOAuthFlow: vi.fn(async () => ({
        success: true,
        code: "auth-code",
        state: "signed-state-123",
      })),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    cleanup();
    delete (window as any).electron;
  });

  it("exchanges Drive, Dropbox and GitHub Electron OAuth codes", async () => {
    for (const item of await loadProviderTokens()) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockResolvedValue(docSnap({}));
      mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
      vi.mocked(fetch).mockResolvedValue(okResponse(true));
      (window as any).electron.startOAuthFlow.mockResolvedValue({
        success: true,
        code: `${item.providerArg}-code`,
        state: "signed-state-123",
      });

      render(<item.Component />);

      fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect((window as any).electron.startOAuthFlow).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: item.providerArg,
            state: "signed-state-123",
          }),
        );
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining(item.endpoint),
        );
      });

      const url = vi.mocked(fetch).mock.calls.at(-1)?.[0] as string;
      expect(url).toContain("code=");
      expect(url).toContain("state=signed-state-123");
      expect(url).toContain(
        `redirect_uri=${encodeURIComponent("http://localhost:8888/callback")}`,
      );
      expect(window.alert).toHaveBeenCalledWith(item.successAlert);
      expect(await screen.findByText(/Connected/)).toBeInTheDocument();
    }
  });

  it("reports Drive, Dropbox and GitHub Electron OAuth failures", async () => {
    for (const item of await loadProviderTokens()) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockResolvedValue(docSnap({}));
      mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
      (window as any).electron.startOAuthFlow.mockResolvedValue({
        success: false,
        error: "denied",
      });

      render(<item.Component />);

      fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith("Error: denied");
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error connecting"),
        expect.any(Error),
      );
    }
  });

  it("reports provider exchange failures after Electron returns a code", async () => {
    for (const item of await loadProviderTokens()) {
      cleanup();
      vi.clearAllMocks();
      mocks.getDoc.mockResolvedValue(docSnap({}));
      mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
      vi.mocked(fetch).mockResolvedValue(okResponse(false));
      (window as any).electron.startOAuthFlow.mockResolvedValue({
        success: true,
        code: "auth-code",
        state: "signed-state-123",
      });

      render(<item.Component />);

      fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith(
          "Error: Failed to exchange tokens",
        );
      });
    }
  });

  it("uses the production Dropbox Cloud Function URL in Electron outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
    vi.mocked(fetch).mockResolvedValue(okResponse(true));
    (window as any).electron.startOAuthFlow.mockResolvedValue({
      success: true,
      code: "dropbox-code",
      state: "signed-state-123",
    });

    const { default: ProductionDropboxToken } = await import(
      "../../pages/Settings/Dropbox/DropboxToken"
    );
    render(<ProductionDropboxToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://us-central1-test-e4cf9.cloudfunctions.net/dropboxOAuthCallback",
        ),
      );
    });
  });

  it("uses the production Google Drive Cloud Function URL in Electron outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
    vi.mocked(fetch).mockResolvedValue(okResponse(true));
    (window as any).electron.startOAuthFlow.mockResolvedValue({
      success: true,
      code: "drive-code",
      state: "signed-state-123",
    });

    const { default: ProductionGoogleDriveToken } = await import(
      "../../pages/Settings/GoogleDrive/GoogleDriveToken"
    );
    render(<ProductionGoogleDriveToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://us-central1-test-e4cf9.cloudfunctions.net/googleDriveOAuthCallback",
        ),
      );
    });
  });

  it("uses the production GitHub Cloud Function URL in Electron outside dev mode", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
    vi.mocked(fetch).mockResolvedValue(okResponse(true));
    (window as any).electron.startOAuthFlow.mockResolvedValue({
      success: true,
      code: "github-code",
      state: "signed-state-123",
    });

    const { default: ProductionGithubToken } = await import(
      "../../pages/Settings/Github/GithubToken"
    );
    render(<ProductionGithubToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://us-central1-test-e4cf9.cloudfunctions.net/githubOAuthCallback",
        ),
      );
    });
  });

  it("shows Dropbox connecting state and default Electron OAuth failure text", async () => {
    let resolveFlow: (value: { success: false }) => void = () => {};
    (window as any).electron.startOAuthFlow.mockReturnValue(
      new Promise((resolve) => {
        resolveFlow = resolve;
      }),
    );
    const { default: DropboxToken } = await import(
      "../../pages/Settings/Dropbox/DropboxToken"
    );

    render(<DropboxToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Connecting...")).toBeInTheDocument();

    resolveFlow({ success: false });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Error: OAuth flow failed");
    });
  });

  it("shows Google Drive connecting state and default Electron OAuth failure text", async () => {
    let resolveFlow: (value: { success: false }) => void = () => {};
    (window as any).electron.startOAuthFlow.mockReturnValue(
      new Promise((resolve) => {
        resolveFlow = resolve;
      }),
    );
    const { default: GoogleDriveToken } = await import(
      "../../pages/Settings/GoogleDrive/GoogleDriveToken"
    );

    render(<GoogleDriveToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Connecting...")).toBeInTheDocument();

    resolveFlow({ success: false });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Error: OAuth flow failed");
    });
  });

  it("shows GitHub connecting state and default Electron OAuth failure text", async () => {
    let resolveFlow: (value: { success: false }) => void = () => {};
    (window as any).electron.startOAuthFlow.mockReturnValue(
      new Promise((resolve) => {
        resolveFlow = resolve;
      }),
    );
    const { default: GithubToken } = await import(
      "../../pages/Settings/Github/GithubToken"
    );

    render(<GithubToken />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Connecting...")).toBeInTheDocument();

    resolveFlow({ success: false });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Error: OAuth flow failed");
    });
  });

  it("exchanges OSF Electron OAuth codes and reloads saved token metadata", async () => {
    mocks.getDoc
      .mockResolvedValueOnce(docSnap({}))
      .mockResolvedValueOnce(
        docSnap({
          osfTokens: { access_token: "osf-token" },
          osfUserName: "OSF User",
          osfProjectId: "abc12",
        }),
      );
    const { default: OsfToken } = await import("../../pages/Settings/OsfToken");

    render(<OsfToken />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );
    expect(
      await screen.findByText(
        "Opening OSF authorization... If it fails, it will retry automatically.",
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect((window as any).electron.startOAuthFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "osf",
          state: "signed-state-123",
        }),
      );
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("osfOAuthCallback"));
    });

    const url = vi.mocked(fetch).mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("code=auth-code");
    expect(url).toContain("state=signed-state-123");
    expect(url).toContain(
      `redirect_uri=${encodeURIComponent("http://localhost:8888/callback")}`,
    );
    expect(window.alert).toHaveBeenCalledWith(
      "OSF connected successfully via OAuth!",
    );
    expect(await screen.findByText(/OSF User/)).toBeInTheDocument();
  });

  it("finishes OSF Electron exchange when the refreshed document is missing", async () => {
    mocks.getDoc
      .mockResolvedValueOnce(docSnap({}))
      .mockResolvedValueOnce({
        exists: () => false,
        data: () => ({}),
      });
    const { default: OsfToken } = await import("../../pages/Settings/OsfToken");

    render(<OsfToken />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    await waitFor(
      () => {
        expect(window.alert).toHaveBeenCalledWith(
          "OSF connected successfully via OAuth!",
        );
      },
      { timeout: 2500 },
    );
    expect(screen.getByText(/Not Connected/)).toBeInTheDocument();
  });

  it("defaults sparse OSF metadata after Electron exchange", async () => {
    mocks.getDoc
      .mockResolvedValueOnce(docSnap({}))
      .mockResolvedValueOnce(
        docSnap({ osfTokens: { access_token: "osf-token" } }),
      );
    const { default: OsfToken } = await import("../../pages/Settings/OsfToken");

    render(<OsfToken />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    await waitFor(
      () => {
        expect(window.alert).toHaveBeenCalledWith(
          "OSF connected successfully via OAuth!",
        );
      },
      { timeout: 2500 },
    );
    expect(screen.getByTitle("Valid OSF Token")).toBeInTheDocument();
    expect(screen.queryByText(/Project:/)).not.toBeInTheDocument();
  });

  it("uses the default OSF Electron OAuth failure message", async () => {
    (window as any).electron.startOAuthFlow.mockResolvedValue({
      success: false,
    });
    const { default: OsfToken } = await import("../../pages/Settings/OsfToken");

    render(<OsfToken />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    expect(
      await screen.findByText(
        "Connection failed: OAuth flow failed",
        {},
        { timeout: 2500 },
      ),
    ).toBeInTheDocument();
  });

  it("reports OSF Electron token exchange failures inline", async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse(false));
    const { default: OsfToken } = await import("../../pages/Settings/OsfToken");

    render(<OsfToken />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );
    expect(
      await screen.findByText(
        "Opening OSF authorization... If it fails, it will retry automatically.",
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        "Connection failed: Failed to exchange tokens",
        {},
        { timeout: 2500 },
      ),
    ).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(
      "Error connecting OSF:",
      expect.any(Error),
    );
  });

  it("retries OSF Electron invalid_client responses and then shows configuration guidance", async () => {
    (window as any).electron.startOAuthFlow.mockResolvedValue({
      success: false,
      error: "invalid_client: pending propagation",
    });
    const { default: OsfToken } = await import("../../pages/Settings/OsfToken");

    render(<OsfToken />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    await screen.findByText(
      "Opening OSF authorization... If it fails, it will retry automatically.",
    );

    expect(
      await screen.findByText(
        "OSF configuration is propagating... Retrying (attempt 2/3)",
        {},
        { timeout: 2500 },
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "OSF configuration is propagating... Retrying (attempt 3/3)",
        {},
        { timeout: 4500 },
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/OSF OAuth configuration error/, {}, { timeout: 4500 }),
    ).toBeInTheDocument();
    expect((window as any).electron.startOAuthFlow).toHaveBeenCalledTimes(3);
  });
});
