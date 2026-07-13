import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UrlContext from "../../../pages/ExperimentBuilder/contexts/UrlContext";
import Timeline from "../../../pages/ExperimentBuilder/components/Timeline";

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

vi.mock("../../../lib/firebase", () => ({
  auth: mocks.auth,
  db: {},
}));

vi.mock("../../../lib/openExternal", () => ({
  openExternal: mocks.openExternal,
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => "exp-123",
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/useExperimentCode",
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

vi.mock(
  "../../../pages/ExperimentBuilder/components/Timeline/FileUploader",
  () => ({
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
  }),
);

vi.mock("../../../pages/ExperimentBuilder/components/Timeline/Actions", () => ({
  default: (props: any) => ({
    handleRunExperiment: () => mocks.handleRunExperiment(props),
    handleShareLocalExperiment: () => mocks.handleShareLocalExperiment(props),
    handleCloseTunnel: () => mocks.handleCloseTunnel(props),
  }),
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/Timeline/PublishExperiment",
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
});
