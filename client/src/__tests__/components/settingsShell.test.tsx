import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "../../pages/Settings";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  searchParams: new URLSearchParams(),
  setSearchParams: vi.fn(),
  authUser: null as { uid: string; email: string } | null,
  unsubscribe: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [mocks.searchParams, mocks.setSearchParams],
  };
});

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
    signOut: vi.fn(),
  })),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(mocks.authUser);
    return mocks.unsubscribe;
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));

vi.mock("../../pages/Settings/GoogleDrive/GoogleDriveToken", () => ({
  default: () => <div data-testid="google-drive-token">Google Drive</div>,
}));

vi.mock("../../pages/Settings/Dropbox/DropboxToken", () => ({
  default: () => <div data-testid="dropbox-token">Dropbox</div>,
}));

vi.mock("../../pages/Settings/Github/GithubToken", () => ({
  default: () => <div data-testid="github-token">GitHub</div>,
}));

vi.mock("../../pages/Settings/OsfToken", () => ({
  default: () => <div data-testid="osf-token">OSF</div>,
}));

vi.mock("../../pages/Settings/FirebaseCredentials", () => ({
  default: () => <div data-testid="firebase-credentials">Firebase</div>,
}));

vi.mock("../../pages/Settings/ChangePassword", () => ({
  default: () => <div data-testid="change-password">Change Password</div>,
}));

vi.mock("../../pages/Settings/DeleteAccount", () => ({
  default: () => <div data-testid="delete-account">Delete Account</div>,
}));

vi.mock("../../pages/Settings/ResetAppButton", () => ({
  default: () => <div data-testid="reset-app">Reset App</div>,
}));

function okJson(payload: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn(async () => payload),
    arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  } as unknown as Response;
}

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

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

const originalLocation = window.location;

describe("Settings shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorage();
    mocks.authUser = {
      uid: "user-123",
      email: "user@test.dev",
    };
    mocks.searchParams = new URLSearchParams();
    (auth as any).signOut = vi.fn(async () => undefined);
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-1", name: "Memory Task" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      return okJson({ success: true });
    }) as unknown as typeof fetch;
    (window as any).electron = {
      saveZipFile: vi.fn(async () => ({ success: true })),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as any).electron;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

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

    expect(screen.getByText("Error connecting dropbox: denied")).toBeInTheDocument();
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

    expect(screen.queryByText(/connected successfully/)).not.toBeInTheDocument();
    expect(mocks.setSearchParams).toHaveBeenCalledWith({});
  });

  it("navigates back and reports logout failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
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

  it("exports all experiments through Electron save dialog", async () => {
    render(<Settings />);

    await screen.findByText(/2 experiments available/);
    fireEvent.click(screen.getByText("Export all"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/export-all-experiments",
      );
      expect((window as any).electron.saveZipFile).toHaveBeenCalledWith(
        [1, 2, 3],
        expect.stringMatching(/^experiments-backup-\d{4}-\d{2}-\d{2}\.zip$/),
      );
    });
    expect(await screen.findByText("All experiments exported!")).toBeInTheDocument();
  });

  it("surfaces export-all server and save-dialog failures", async () => {
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [{ experimentID: "exp-1", name: "Memory Task" }],
        });
      }
      if (url === "http://localhost:3000/api/export-all-experiments") {
        return okJson({ error: "server refused export" }, false);
      }
      return okJson({ success: true });
    });

    render(<Settings />);

    await screen.findByText(/1 experiment available/);
    fireEvent.click(screen.getByText("Export all"));

    expect(await screen.findByText("server refused export")).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [{ experimentID: "exp-1", name: "Memory Task" }],
        });
      }
      return okJson({ success: true });
    });
    (window as any).electron.saveZipFile.mockResolvedValueOnce({
      success: false,
      error: "disk full",
    });

    fireEvent.click(screen.getByText("Export all"));

    expect(await screen.findByText("disk full")).toBeInTheDocument();
  });

  it("falls back when export-all error responses cannot be parsed", async () => {
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [{ experimentID: "exp-1", name: "Memory Task" }],
        });
      }
      if (url === "http://localhost:3000/api/export-all-experiments") {
        return {
          ok: false,
          json: vi.fn(async () => {
            throw new Error("invalid json");
          }),
          arrayBuffer: vi.fn(),
        } as unknown as Response;
      }
      return okJson({ success: true });
    });

    render(<Settings />);

    await screen.findByText(/1 experiment available/);
    fireEvent.click(screen.getByText("Export all"));

    expect(await screen.findByText("Error exporting experiments")).toBeInTheDocument();
  });

  it("exports selected experiments and resets the selection modal", async () => {
    render(<Settings />);

    await screen.findByText(/2 experiments available/);
    fireEvent.click(screen.getByText("Export selected..."));

    expect(screen.getByText("Export experiments")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Memory Task"));
    fireEvent.click(screen.getByText("Export (1)"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/export-experiment/exp-1",
      );
      expect((window as any).electron.saveZipFile).toHaveBeenCalledWith(
        [1, 2, 3],
        "Memory_Task-backup.zip",
      );
    });
    expect(await screen.findByText("Experiment exported!")).toBeInTheDocument();
    expect(screen.queryByText("Export experiments")).not.toBeInTheDocument();
  });

  it("selects all experiments, unselects one, cancels, and closes the export modal from the overlay", async () => {
    const { container } = render(<Settings />);

    await screen.findByText(/2 experiments available/);
    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));

    expect(screen.getByText("2 of 2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Select all (2)"));
    expect(screen.getByText("0 of 2 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Select all (2)"));

    fireEvent.click(screen.getByLabelText("Visual Search"));
    expect(screen.getByText("1 of 2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Export experiments")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(container.querySelector(".backup-modal-overlay")!);

    expect(screen.queryByText("Export experiments")).not.toBeInTheDocument();
  });

  it("exports multiple selected experiments and reports selected export failures", async () => {
    render(<Settings />);

    await screen.findByText(/2 experiments available/);
    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/export-all-experiments?ids=exp-1%2Cexp-2",
      );
    });
    expect(
      await screen.findByText("2 experiments exported!"),
    ).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-1", name: "Memory Task" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      if (url === "http://localhost:3000/api/export-experiment/exp-1") {
        return okJson({ error: "bad single export" }, false);
      }
      return okJson({ success: true });
    });

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Memory Task"));
    fireEvent.click(screen.getByText("Export (1)"));

    expect(await screen.findByText("Export failed")).toBeInTheDocument();

    (window as any).electron.saveZipFile.mockResolvedValueOnce({
      success: false,
      error: "save cancelled by disk",
    });
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-1", name: "Memory Task" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      return okJson({ success: true });
    });

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Memory Task"));
    fireEvent.click(screen.getByText("Export (1)"));

    expect(await screen.findByText("save cancelled by disk")).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-1", name: "Memory Task" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      if (
        url ===
        "http://localhost:3000/api/export-all-experiments?ids=exp-1%2Cexp-2"
      ) {
        return okJson({ error: "bad multi export" }, false);
      }
      return okJson({ success: true });
    });

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));

    expect(await screen.findByText("Export failed")).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-1", name: "Memory Task" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      return okJson({ success: true });
    });
    (window as any).electron.saveZipFile.mockResolvedValueOnce({
      success: false,
      error: "multi disk full",
    });

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));

    expect(await screen.findByText("multi disk full")).toBeInTheDocument();
  });

  it("handles cancelled and sparse Electron export results", async () => {
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-plain" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      return okJson({ success: true });
    });
    const saveZipFile = (window as any).electron.saveZipFile;
    saveZipFile
      .mockResolvedValueOnce({ success: false, error: "Cancelled" })
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: false, error: "Cancelled" })
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: false, error: "Cancelled" })
      .mockResolvedValueOnce({ success: false });

    render(<Settings />);
    await screen.findByText(/2 experiments available/);

    fireEvent.click(screen.getByText("Export all"));
    await waitFor(() => expect(saveZipFile).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Export failed")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Export all"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("exp-plain"));
    fireEvent.click(screen.getByText("Export (1)"));
    await waitFor(() => expect(saveZipFile).toHaveBeenCalledTimes(3));
    expect(saveZipFile).toHaveBeenLastCalledWith(
      [1, 2, 3],
      "exp-plain-backup.zip",
    );
    expect(screen.queryByText("Export failed")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("exp-plain"));
    fireEvent.click(screen.getByText("Export (1)"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));
    await waitFor(() => expect(saveZipFile).toHaveBeenCalledTimes(5));
    expect(screen.queryByText("Export failed")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));

    fetchMock().mockRejectedValueOnce({});
    fireEvent.click(screen.getByText("Export all"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));

    fetchMock().mockRejectedValueOnce({});
    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("exp-plain"));
    fireEvent.click(screen.getByText("Export (1)"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
  });

  it("imports backup ZIPs and schedules a reload on success", async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({ experiments: [] });
      }
      if (url === "http://localhost:3000/api/import-experiments") {
        return okJson({ success: true, imported: 2 });
      }
      return okJson({ success: true });
    });

    const { container } = render(<Settings />);

    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    )!;
    const file = new File(["zip"], "backup.zip", { type: "application/zip" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText("2 experiment(s) imported successfully!"),
    ).toBeInTheDocument();
    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3000/api/import-experiments",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(reload).toHaveBeenCalled();
  });

  it("opens the import picker and reports import validation or network failures", async () => {
    const { container } = render(<Settings />);

    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    )!;
    const clickSpy = vi.spyOn(input, "click").mockImplementation(() => {});

    await screen.findByText("Settings");
    fireEvent.click(screen.getByText("Choose .zip file"));
    expect(clickSpy).toHaveBeenCalled();

    fireEvent.change(input, { target: { files: [] } });
    expect(fetchMock()).not.toHaveBeenCalledWith(
      "http://localhost:3000/api/import-experiments",
      expect.anything(),
    );

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({ experiments: [] });
      }
      if (url === "http://localhost:3000/api/import-experiments") {
        return okJson({ success: false, error: "bad zip" });
      }
      return okJson({ success: true });
    });

    fireEvent.change(input, {
      target: {
        files: [new File(["zip"], "bad.zip", { type: "application/zip" })],
      },
    });

    expect(await screen.findByText("bad zip")).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({ experiments: [] });
      }
      if (url === "http://localhost:3000/api/import-experiments") {
        return okJson({ success: false });
      }
      return okJson({ success: true });
    });

    fireEvent.change(input, {
      target: {
        files: [new File(["zip"], "missing-error.zip", { type: "application/zip" })],
      },
    });

    expect(await screen.findByText("Failed to import")).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({ experiments: [] });
      }
      if (url === "http://localhost:3000/api/import-experiments") {
        throw new Error("network down");
      }
      return okJson({ success: true });
    });

    fireEvent.change(input, {
      target: {
        files: [new File(["zip"], "network.zip", { type: "application/zip" })],
      },
    });

    expect(await screen.findByText("Failed to import")).toBeInTheDocument();
  });
});
