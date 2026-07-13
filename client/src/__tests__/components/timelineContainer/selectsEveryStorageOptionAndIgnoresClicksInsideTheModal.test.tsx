import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageSelectModal } from "../../../pages/ExperimentBuilder/components/Timeline/StorageSelectModal";

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
    expect(
      screen.queryByText("Select Storage Provider"),
    ).not.toBeInTheDocument();

    rerender(
      <StorageSelectModal
        isOpen
        availableStorages={["googledrive", "dropbox", "osf"]}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(
      screen
        .getByText("Select Storage Provider")
        .closest(".storage-modal-content")!,
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
      screen
        .getByText("Select Storage Provider")
        .closest(".storage-modal-overlay")!,
    );
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
