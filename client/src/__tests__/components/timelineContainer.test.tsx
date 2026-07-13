import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UrlContext from "../../pages/ExperimentBuilder/contexts/UrlContext";
import Timeline from "../../pages/ExperimentBuilder/components/Timeline";
import { StorageSelectModal } from "../../pages/ExperimentBuilder/components/Timeline/StorageSelectModal";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string } | null },
  authUser: null as { uid: string } | null,
  unsubscribe: vi.fn(),
  firestoreData: {} as Record<string, unknown>,
  firestoreDoc: vi.fn((...segments: unknown[]) => segments.slice(1).join("/")),
  firestoreGetDoc: vi.fn(),
  openExternal: vi.fn(),
  fileUploaderProps: undefined as any,
  experimentCodeUploadedFiles: undefined as any,
  generateLocalExperiment: vi.fn(),
  generateExperiment: vi.fn(),
  handleRunExperiment: vi.fn(),
  handleShareLocalExperiment: vi.fn(),
  handleCloseTunnel: vi.fn(),
  handlePublishToGitHub: vi.fn(),
  publishWithStorage: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(mocks.authUser);
    return mocks.unsubscribe;
  }),
}));

vi.mock("firebase/firestore", () => ({
  doc: mocks.firestoreDoc,
  getDoc: mocks.firestoreGetDoc,
  getFirestore: vi.fn(() => ({})),
  setDoc: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock("../../lib/firebase", () => ({
  auth: mocks.auth,
  db: {},
}));

vi.mock("../../lib/openExternal", () => ({
  openExternal: mocks.openExternal,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => "exp-123",
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/useExperimentCode",
  () => ({
    useExperimentCode: (uploadedFiles: unknown[]) => {
      mocks.experimentCodeUploadedFiles = uploadedFiles;
      return {
        generateLocalExperiment: mocks.generateLocalExperiment,
        generateExperiment: mocks.generateExperiment,
        generatedBaseCode: "base-code",
      };
    },
  }),
);

vi.mock("../../pages/ExperimentBuilder/components/Timeline/FileUploader", () => ({
  default: (props: any) => {
    mocks.fileUploaderProps = props;
    return (
      <div data-testid="file-uploader">
        <span data-testid="file-accept">{props.accept}</span>
        <span data-testid="file-count">{props.uploadedFiles.length}</span>
        <button
          type="button"
          onClick={() =>
            props.onFileUpload({
              target: { files: [new File(["x"], "asset.png")] },
            })
          }
        >
          Upload Asset
        </button>
        <button
          type="button"
          onClick={() => props.onDeleteFile(props.uploadedFiles[0])}
        >
          Delete First Asset
        </button>
        <button
          type="button"
          onClick={() => props.onDeleteMultipleFiles?.(props.uploadedFiles)}
        >
          Delete All Assets
        </button>
      </div>
    );
  },
}));

vi.mock("../../pages/ExperimentBuilder/components/Timeline/Actions", () => ({
  default: (props: any) => ({
    handleRunExperiment: () => mocks.handleRunExperiment(props),
    handleShareLocalExperiment: () => mocks.handleShareLocalExperiment(props),
    handleCloseTunnel: () => mocks.handleCloseTunnel(props),
  }),
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Timeline/PublishExperiment",
  () => ({
    default: (props: any) => ({
      handlePublishToGitHub: () => mocks.handlePublishToGitHub(props),
      publishWithStorage: (uid: string, storage: string) =>
        mocks.publishWithStorage(uid, storage, props),
    }),
  }),
);

function okDoc(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  };
}

function renderTimeline(initialExperimentUrl = "") {
  const uploadedFiles = [
    { name: "asset.png", url: "/uploads/asset.png", type: "image" },
  ];
  const handleFileUpload = vi.fn(async () => undefined);
  const handleDeleteFile = vi.fn(async () => undefined);
  const handleDeleteMultipleFiles = vi.fn(async () => undefined);
  const fileInputRef = React.createRef<HTMLInputElement>();
  const folderInputRef = React.createRef<HTMLInputElement>();

  function Wrapper() {
    const [experimentUrl, setExperimentUrl] = useState(initialExperimentUrl);
    const [trialUrl, setTrialUrl] = useState("");
    return (
      <UrlContext.Provider
        value={{ experimentUrl, setExperimentUrl, trialUrl, setTrialUrl }}
      >
        <Timeline
          uploadedFiles={uploadedFiles}
          fileInputRef={fileInputRef}
          folderInputRef={folderInputRef}
          handleFileUpload={handleFileUpload}
          handleDeleteFile={handleDeleteFile}
          handleDeleteMultipleFiles={handleDeleteMultipleFiles}
        />
      </UrlContext.Provider>
    );
  }

  const view = render(<Wrapper />);

  return {
    ...view,
    uploadedFiles,
    handleFileUpload,
    handleDeleteFile,
    handleDeleteMultipleFiles,
    fileInputRef,
    folderInputRef,
  };
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

function installClipboard(writeText = vi.fn(async () => undefined)) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

describe("Timeline container", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorage();
    installClipboard();
    mocks.auth.currentUser = null;
    mocks.authUser = null;
    mocks.firestoreData = {};
    mocks.firestoreDoc.mockImplementation((...segments: unknown[]) =>
      segments.slice(1).join("/"),
    );
    mocks.firestoreGetDoc.mockImplementation(async () =>
      okDoc(mocks.firestoreData),
    );
    mocks.generateLocalExperiment.mockResolvedValue("local-code");
    mocks.generateExperiment.mockResolvedValue("public-code");
    mocks.handleRunExperiment.mockImplementation((props: any) => {
      props.setSubmitStatus("Build success");
      props.setExperimentUrl("https://local.test/exp-123");
    });
    mocks.handleShareLocalExperiment.mockImplementation((props: any) => {
      props.setTunnelStatus("Tunnel ready");
      props.setTunnelActive(true);
      props.setActiveTunnelUrl("https://tunnel.test");
    });
    mocks.handleCloseTunnel.mockImplementation((props: any) => {
      props.setTunnelActive(false);
      props.setTunnelStatus("Tunnel closed");
    });
    mocks.handlePublishToGitHub.mockImplementation((props: any) => {
      props.setAvailableStorages(["googledrive", "dropbox"]);
      props.setShowStorageModal(true);
    });
    mocks.publishWithStorage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes files into code generation and FileUploader, then wires build/share/run actions", async () => {
    const { uploadedFiles, handleFileUpload, handleDeleteFile, handleDeleteMultipleFiles } =
      renderTimeline();

    expect(mocks.experimentCodeUploadedFiles).toEqual([
      { name: "asset.png", url: "/uploads/asset.png", type: "image" },
    ]);
    expect(screen.getByTestId("file-accept")).toHaveTextContent(
      "audio/*,video/*,image/*",
    );
    expect(screen.getByTestId("file-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByText("Upload Asset"));
    fireEvent.click(screen.getByText("Delete First Asset"));
    fireEvent.click(screen.getByText("Delete All Assets"));

    expect(handleFileUpload).toHaveBeenCalled();
    expect(handleDeleteFile).toHaveBeenCalledWith({
      name: "asset.png",
      url: "/uploads/asset.png",
      type: "image",
    });
    expect(handleDeleteMultipleFiles).toHaveBeenCalledWith(uploadedFiles);

    fireEvent.click(screen.getByText("Build Experiment"));
    expect(await screen.findByText("Build success")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Run experiment"));
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://local.test/exp-123",
    );

    fireEvent.click(screen.getByText("Share Local Experiment"));
    expect(await screen.findByText("Tunnel ready")).toBeInTheDocument();
    expect(screen.getByText("Copy Tunnel Link")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Copy Tunnel Link"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://tunnel.test/exp-123",
    );
    expect(await screen.findByText("Tunnel link copied!")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Close tunnel"));
    expect(await screen.findByText("Tunnel closed")).toBeInTheDocument();
  });

  it("styles failed, error and informational build statuses", async () => {
    const cases = [
      ["Build Failed", "#f8d7da", "#721c24"],
      ["Build error", "#f8d7da", "#721c24"],
      ["Building experiment", "#cce5ff", "#004085"],
    ] as const;

    for (const [status, backgroundColor, color] of cases) {
      mocks.handleRunExperiment.mockImplementation((props: any) => {
        props.setSubmitStatus(status);
      });
      const view = renderTimeline();

      fireEvent.click(screen.getByText("Build Experiment"));

      expect(await screen.findByText(status)).toHaveStyle({
        backgroundColor,
        color,
      });
      view.unmount();
    }
  });

  it("shows processing and tunnel-creation states", async () => {
    mocks.handleRunExperiment.mockImplementation((props: any) => {
      props.setIsSubmitting(true);
    });
    const buildView = renderTimeline();

    fireEvent.click(screen.getByText("Build Experiment"));
    expect(await screen.findByText("Processing...")).toBeDisabled();
    buildView.unmount();

    mocks.handleShareLocalExperiment.mockImplementation((props: any) => {
      props.setIsTunnelCreating(true);
    });
    renderTimeline();

    fireEvent.click(screen.getByText("Share Local Experiment"));
    expect(await screen.findByText("Creating tunnel...")).toBeDisabled();
  });

  it("runs using a persisted tunnel URL even when experimentUrl is empty", () => {
    localStorage.setItem("tunnelUrl", "https://stored-tunnel.test");

    renderTimeline();

    fireEvent.click(screen.getByText("Run experiment"));

    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://stored-tunnel.test/exp-123",
    );
  });

  it("ignores run and hover events after a persisted tunnel URL disappears", () => {
    localStorage.setItem("tunnelUrl", "https://stored-tunnel.test");
    renderTimeline();
    const runButton = screen.getByText("Run experiment");
    const initialBackground = runButton.style.backgroundColor;

    localStorage.removeItem("tunnelUrl");
    fireEvent.mouseEnter(runButton);
    fireEvent.mouseLeave(runButton);
    fireEvent.click(runButton);

    expect(runButton.style.backgroundColor).toBe(initialBackground);
    expect(mocks.openExternal).not.toHaveBeenCalled();
  });

  it("uses cached user tokens without reading Firestore", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    mocks.authUser = { uid: "user-123" };
    mocks.auth.currentUser = { uid: "user-123" };
    localStorage.setItem(
      "userTokens_user-123",
      JSON.stringify({
        tokens: {
          drive: false,
          dropbox: true,
          osf: false,
          github: true,
        },
        ts: 10_000,
      }),
    );

    renderTimeline("https://published-source.test/exp-123");

    await waitFor(() => {
      expect(screen.getByText("Publish to GitHub Pages")).toBeEnabled();
    });
    expect(mocks.firestoreGetDoc).not.toHaveBeenCalled();
  });

  it("refreshes user tokens when the local cache is stale", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    mocks.authUser = { uid: "user-123" };
    mocks.auth.currentUser = { uid: "user-123" };
    mocks.firestoreData = {
      githubTokens: { access_token: "github" },
      osfTokens: { access_token: "osf" },
    };
    localStorage.setItem(
      "userTokens_user-123",
      JSON.stringify({
        tokens: {
          drive: false,
          dropbox: false,
          osf: false,
          github: false,
        },
        ts: 1,
      }),
    );

    renderTimeline("https://published-source.test/exp-123");

    await waitFor(() => {
      expect(mocks.firestoreGetDoc).toHaveBeenCalled();
      expect(screen.getByText("Publish to GitHub Pages")).toBeEnabled();
    });
  });

  it("loads connected user tokens and confirms a publish storage choice", async () => {
    mocks.authUser = { uid: "user-123" };
    mocks.auth.currentUser = { uid: "user-123" };
    mocks.firestoreData = {
      googleDriveTokens: { access_token: "drive" },
      dropboxTokens: { access_token: "dropbox" },
      githubTokens: { access_token: "github" },
    };

    renderTimeline("https://published-source.test/exp-123");

    await waitFor(() => {
      expect(screen.getByText("Publish to GitHub Pages")).toBeEnabled();
    });
    expect(mocks.firestoreDoc).toHaveBeenCalledWith({}, "users", "user-123");

    fireEvent.click(screen.getByText("Publish to GitHub Pages"));

    expect(await screen.findByText("Select Storage Provider")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Dropbox"));
    fireEvent.click(screen.getByText("Confirm"));

    expect(mocks.publishWithStorage).toHaveBeenCalledWith(
      "user-123",
      "dropbox",
      expect.any(Object),
    );
  });

  it("publishes with the selected storage, shows status and copies the pages link", async () => {
    mocks.authUser = { uid: "user-123" };
    mocks.auth.currentUser = { uid: "user-123" };
    mocks.firestoreData = {
      googleDriveTokens: { access_token: "drive" },
      githubTokens: { access_token: "github" },
    };
    mocks.publishWithStorage.mockImplementation(
      async (_uid: string, _storage: string, props: any) => {
        props.setPublishStatus("Published to GitHub Pages");
        props.setLastPagesUrl("https://pages.test/exp-123");
        props.setShowStorageModal(false);
        props.setIsPublishing(false);
      },
    );

    renderTimeline("https://published-source.test/exp-123");

    await waitFor(() => {
      expect(screen.getByText("Publish to GitHub Pages")).toBeEnabled();
    });
    fireEvent.click(screen.getByText("Publish to GitHub Pages"));
    fireEvent.click(await screen.findByText("Confirm"));

    expect(await screen.findByText("Published to GitHub Pages")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Copy GitHub Pages Link"));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://pages.test/exp-123",
    );
    expect(
      await screen.findByText("GitHub Pages link copied!"),
    ).toBeInTheDocument();
  });

  it("renders publish errors in the error color", async () => {
    mocks.authUser = { uid: "user-123" };
    mocks.auth.currentUser = { uid: "user-123" };
    mocks.firestoreData = {
      googleDriveTokens: { access_token: "drive" },
      githubTokens: { access_token: "github" },
    };
    mocks.publishWithStorage.mockImplementation(
      async (_uid: string, _storage: string, props: any) => {
        props.setPublishStatus("Error publishing experiment");
        props.setShowStorageModal(false);
        props.setIsPublishing(false);
      },
    );

    renderTimeline("https://published-source.test/exp-123");

    await waitFor(() => {
      expect(screen.getByText("Publish to GitHub Pages")).toBeEnabled();
    });
    fireEvent.click(screen.getByText("Publish to GitHub Pages"));
    fireEvent.click(await screen.findByText("Confirm"));

    expect(await screen.findByText("Error publishing experiment")).toHaveStyle({
      color: "#f44336",
    });
  });

  it("cancels storage selection without publishing", async () => {
    mocks.authUser = { uid: "user-123" };
    mocks.auth.currentUser = { uid: "user-123" };
    mocks.firestoreData = {
      googleDriveTokens: { access_token: "drive" },
      dropboxTokens: { access_token: "dropbox" },
      githubTokens: { access_token: "github" },
    };

    renderTimeline("https://published-source.test/exp-123");

    await waitFor(() => {
      expect(screen.getByText("Publish to GitHub Pages")).toBeEnabled();
    });
    fireEvent.click(screen.getByText("Publish to GitHub Pages"));
    expect(await screen.findByText("Select Storage Provider")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.queryByText("Select Storage Provider")).not.toBeInTheDocument();
    });
    expect(mocks.publishWithStorage).not.toHaveBeenCalled();
  });

  it("keeps publishing disabled without both GitHub and a storage token", async () => {
    mocks.authUser = { uid: "user-123" };
    mocks.auth.currentUser = { uid: "user-123" };
    mocks.firestoreData = {
      githubTokens: { access_token: "github" },
    };

    renderTimeline("https://published-source.test/exp-123");

    await waitFor(() => {
      expect(mocks.firestoreGetDoc).toHaveBeenCalled();
    });
    expect(screen.getByText("Publish to GitHub Pages")).toBeDisabled();
  });

  it("selects every storage option and ignores clicks inside the modal body", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <StorageSelectModal
        isOpen={false}
        availableStorages={["googledrive"]}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.queryByText("Select Storage Provider")).not.toBeInTheDocument();

    rerender(
      <StorageSelectModal
        isOpen
        availableStorages={["googledrive", "dropbox", "osf"]}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(
      screen.getByText("Select Storage Provider").closest(".storage-modal-content")!,
    );
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenLastCalledWith("googledrive");

    fireEvent.click(screen.getByRole("button", { name: /OSF/ }));
    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenLastCalledWith("osf");

    fireEvent.click(screen.getByRole("button", { name: /Google Drive/ }));
    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenLastCalledWith("googledrive");

    fireEvent.click(screen.getByRole("button", { name: /Dropbox/ }));
    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenLastCalledWith("dropbox");

    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByText("Select Storage Provider").closest(".storage-modal-overlay")!,
    );
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
