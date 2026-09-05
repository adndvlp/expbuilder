import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installClipboard,
  installLocalStorage,
  okDoc,
  renderTimeline,
} from "./renderHarness";

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
  subscribeToAuth: vi.fn((callback) => {
    callback(mocks.authUser);
    return mocks.unsubscribe;
  }),
  getFirebaseAuth: vi.fn(async () => mocks.auth),
  getFirebaseDb: vi.fn(async () => ({})),
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

    expect(
      await screen.findByText("Select Storage Provider"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Dropbox"));
    fireEvent.click(screen.getByText("Confirm"));

    expect(mocks.publishWithStorage).toHaveBeenCalledWith(
      "user-123",
      "dropbox",
      expect.any(Object),
    );
  });
});
