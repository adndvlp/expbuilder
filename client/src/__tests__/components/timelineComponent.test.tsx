import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Timeline from "../../pages/ExperimentBuilder/components/Timeline";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "user-1" } as { uid: string } | null },
  firebaseUser: { uid: "user-1" } as { uid: string } | null,
  getDoc: vi.fn(),
  doc: vi.fn(() => ({ path: "users/user-1" })),
  unsubscribe: vi.fn(),
  openExternal: vi.fn(),
  initialExperimentUrl: "https://example.test/experiment",
  publishWithStorageSpy: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: { uid: string } | null) => void) => {
    callback(mocks.firebaseUser);
    return mocks.unsubscribe;
  },
}));

vi.mock("firebase/firestore", () => ({
  doc: mocks.doc,
  getDoc: mocks.getDoc,
}));

vi.mock("../../lib/firebase", () => ({
  auth: mocks.auth,
  db: { name: "db" },
}));

vi.mock("../../lib/openExternal", () => ({
  openExternal: mocks.openExternal,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => "exp-123",
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useUrl", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    default: () => {
      const [experimentUrl, setExperimentUrl] = React.useState(
        mocks.initialExperimentUrl,
      );
      return { experimentUrl, setExperimentUrl };
    },
  };
});

vi.mock(
  "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/useExperimentCode",
  () => ({
    useExperimentCode: () => ({
      generateLocalExperiment: vi.fn(async () => "local-code"),
      generateExperiment: vi.fn(async () => "public-code"),
      generatedBaseCode: vi.fn(async () => "base-code"),
    }),
  }),
);

vi.mock("../../pages/ExperimentBuilder/components/Timeline/FileUploader", () => ({
  default: ({
    uploadedFiles,
    onFileUpload,
    onDeleteFile,
    onDeleteMultipleFiles,
    uploadStatus,
    accept,
  }: any) => (
    <div data-testid="file-uploader" data-accept={accept}>
      <span>{uploadStatus}</span>
      <span>{uploadedFiles.map((file: any) => file.name).join(",")}</span>
      <button
        type="button"
        onClick={() =>
          onFileUpload({ target: { files: [] } } as unknown as React.ChangeEvent<HTMLInputElement>)
        }
      >
        upload file
      </button>
      <button type="button" onClick={() => onDeleteFile(uploadedFiles[0])}>
        delete file
      </button>
      <button
        type="button"
        onClick={() => onDeleteMultipleFiles?.(uploadedFiles)}
      >
        delete many
      </button>
    </div>
  ),
}));

vi.mock("../../pages/ExperimentBuilder/components/Timeline/Actions", () => ({
  default: (props: any) => ({
    handleRunExperiment: async () => {
      props.setIsSubmitting(true);
      props.setSubmitStatus("success: built");
      props.setExperimentUrl("https://example.test/built");
      props.setIsSubmitting(false);
    },
    handleShareLocalExperiment: async () => {
      props.setIsTunnelCreating(true);
      props.setTunnelStatus("Tunnel ready");
      props.setTunnelActive(true);
      props.setActiveTunnelUrl("https://tunnel.test");
      props.setIsTunnelCreating(false);
    },
    handleCloseTunnel: () => {
      props.setTunnelActive(false);
      props.setTunnelStatus("Tunnel closed");
      props.setActiveTunnelUrl("");
    },
  }),
}));

vi.mock("../../pages/ExperimentBuilder/components/Timeline/PublishExperiment", () => ({
  default: (props: any) => ({
    handlePublishToGitHub: async () => {
      props.setIsPublishing(true);
      props.setAvailableStorages(["googledrive", "osf"]);
      props.setLastPagesUrl("https://pages.test/exp-123");
      props.setPublishStatus("Ready to publish");
      props.setShowStorageModal(true);
    },
    publishWithStorage: async (uid: string, storage: string) => {
      mocks.publishWithStorageSpy(uid, storage);
      props.setPublishStatus(`Published with ${storage}`);
      props.setShowStorageModal(false);
      props.setIsPublishing(false);
    },
  }),
}));

vi.mock("../../pages/ExperimentBuilder/components/Timeline/StorageSelectModal", () => ({
  StorageSelectModal: ({ isOpen, availableStorages, onConfirm, onCancel }: any) =>
    isOpen ? (
      <div data-testid="storage-modal">
        <span>{availableStorages.join(",")}</span>
        <button type="button" onClick={() => onConfirm(availableStorages[0])}>
          confirm storage
        </button>
        <button type="button" onClick={onCancel}>
          cancel storage
        </button>
      </div>
    ) : null,
}));

function renderTimeline() {
  const file = { name: "stimulus.png", url: "/stimulus.png", type: "image/png" };
  return render(
    <Timeline
      uploadedFiles={[file]}
      fileInputRef={{ current: null }}
      folderInputRef={{ current: null }}
      uploadStatus="ready"
      handleFileUpload={vi.fn(async () => undefined)}
      handleDeleteFile={vi.fn(async () => undefined)}
      handleDeleteMultipleFiles={vi.fn(async () => undefined)}
    />,
  );
}

function setClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

function installLocalStorage() {
  const store: Record<string, string> = {};
  const storage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
}

describe("Timeline component", () => {
  beforeEach(() => {
    installLocalStorage();
    vi.clearAllMocks();
    localStorage.clear();
    mocks.auth.currentUser = { uid: "user-1" };
    mocks.firebaseUser = { uid: "user-1" };
    mocks.initialExperimentUrl = "https://example.test/experiment";
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        googleDriveTokens: true,
        githubTokens: true,
      }),
    });
    setClipboard(vi.fn(async () => undefined));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("loads empty token state when the user document is missing", async () => {
    mocks.getDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => ({}),
    });

    renderTimeline();

    await waitFor(() => {
      expect(localStorage.getItem("userTokens_user-1")).toContain('"github":false');
    });
    expect(screen.getByRole("button", { name: "Publish to GitHub Pages" })).toBeDisabled();
  });

  it("falls back to empty token state when Firestore token loading fails", async () => {
    mocks.getDoc.mockRejectedValueOnce(new Error("firestore unavailable"));

    renderTimeline();

    await waitFor(() => {
      expect(mocks.getDoc).toHaveBeenCalled();
    });
    expect(screen.getByRole("button", { name: "Publish to GitHub Pages" })).toBeDisabled();
  });

  it("loads connected storage tokens from Firestore when no cache exists", async () => {
    renderTimeline();

    await waitFor(() => {
      expect(localStorage.getItem("userTokens_user-1")).toContain('"github":true');
    });
    expect(screen.getByRole("button", { name: "Publish to GitHub Pages" })).toBeEnabled();
  });

  it("keeps token state empty when auth reports no firebase user", async () => {
    mocks.firebaseUser = null;

    renderTimeline();

    expect(mocks.getDoc).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Publish to GitHub Pages" })).toBeDisabled();
  });

  it("uses cached tokens, opens URLs, shares tunnels, copies links and publishes with storage", async () => {
    localStorage.setItem(
      "userTokens_user-1",
      JSON.stringify({
        tokens: { drive: true, dropbox: false, osf: false, github: true },
        ts: Date.now(),
      }),
    );
    const clipboard = vi.fn(async () => undefined);
    setClipboard(clipboard);

    renderTimeline();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Publish to GitHub Pages" })).toBeEnabled();
    });
    expect(mocks.getDoc).not.toHaveBeenCalled();

    const runButton = screen.getByRole("button", { name: "Run experiment" });
    fireEvent.mouseEnter(runButton);
    fireEvent.mouseLeave(runButton);
    fireEvent.click(runButton);
    expect(mocks.openExternal).toHaveBeenCalledWith("https://example.test/experiment");

    fireEvent.click(screen.getByRole("button", { name: "Build Experiment" }));
    await screen.findByText("success: built");

    fireEvent.click(screen.getByRole("button", { name: "Share Local Experiment" }));
    await screen.findByText("Tunnel ready");
    expect(screen.getByRole("button", { name: "Close tunnel" })).toBeInTheDocument();

    const tunnelCopy = await screen.findByRole("button", {
      name: "Copy Tunnel Link",
    });
    fireEvent.mouseEnter(tunnelCopy);
    fireEvent.mouseLeave(tunnelCopy);
    fireEvent.click(tunnelCopy);
    await screen.findByText("Tunnel link copied!");
    expect(clipboard).toHaveBeenCalledWith("https://tunnel.test/exp-123");

    clipboard.mockRejectedValueOnce(new Error("copy failed"));
    fireEvent.click(tunnelCopy);
    await screen.findByText("Failed to copy.");

    fireEvent.click(screen.getByRole("button", { name: "Publish to GitHub Pages" }));
    await screen.findByTestId("storage-modal");
    expect(screen.getByText("Ready to publish")).toBeInTheDocument();

    const pagesCopy = await screen.findByRole("button", {
      name: "Copy GitHub Pages Link",
    });
    fireEvent.mouseEnter(pagesCopy);
    fireEvent.mouseLeave(pagesCopy);
    clipboard.mockResolvedValueOnce(undefined);
    fireEvent.click(pagesCopy);
    await screen.findByText("GitHub Pages link copied!");

    clipboard.mockRejectedValueOnce(new Error("pages copy failed"));
    fireEvent.click(pagesCopy);
    await screen.findByText("Failed to copy.");

    await new Promise((resolve) => setTimeout(resolve, 2100));
    expect(screen.queryByText("Tunnel link copied!")).not.toBeInTheDocument();
    expect(screen.queryByText("GitHub Pages link copied!")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "confirm storage" }));
    await waitFor(() => {
      expect(mocks.publishWithStorageSpy).toHaveBeenCalledWith(
        "user-1",
        "googledrive",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Publish to GitHub Pages" }));
    await screen.findByTestId("storage-modal");
    fireEvent.click(screen.getByRole("button", { name: "cancel storage" }));
    expect(screen.queryByTestId("storage-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close tunnel" }));
    expect(await screen.findByText("Tunnel closed")).toBeInTheDocument();
  });

  it("does not publish selected storage when Firebase currentUser is absent", async () => {
    localStorage.setItem(
      "userTokens_user-1",
      JSON.stringify({
        tokens: { drive: true, dropbox: false, osf: false, github: true },
        ts: Date.now(),
      }),
    );
    mocks.auth.currentUser = null;

    renderTimeline();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Publish to GitHub Pages" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish to GitHub Pages" }));
    await screen.findByTestId("storage-modal");
    fireEvent.click(screen.getByRole("button", { name: "confirm storage" }));

    expect(mocks.publishWithStorageSpy).not.toHaveBeenCalled();
  });
});
