import { render } from "@testing-library/react";
import { vi } from "vitest";
import Timeline from "../../../pages/ExperimentBuilder/components/Timeline";

const hoistedMocks = vi.hoisted(() => ({
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
  onAuthStateChanged: (
    _auth: unknown,
    callback: (user: { uid: string } | null) => void,
  ) => {
    callback(hoistedMocks.firebaseUser);
    return hoistedMocks.unsubscribe;
  },
}));

vi.mock("firebase/firestore", () => ({
  doc: hoistedMocks.doc,
  getDoc: hoistedMocks.getDoc,
}));

vi.mock("../../../lib/firebase", () => ({
  auth: hoistedMocks.auth,
  db: { name: "db" },
}));

vi.mock("../../../lib/openExternal", () => ({
  openExternal: hoistedMocks.openExternal,
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => "exp-123",
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useUrl", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    default: () => {
      const [experimentUrl, setExperimentUrl] = React.useState(
        hoistedMocks.initialExperimentUrl,
      );
      return { experimentUrl, setExperimentUrl };
    },
  };
});

vi.mock(
  "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/useExperimentCode",
  () => ({
    useExperimentCode: () => ({
      generateLocalExperiment: vi.fn(async () => "local-code"),
      generateExperiment: vi.fn(async () => "public-code"),
      generatedBaseCode: vi.fn(async () => "base-code"),
    }),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/Timeline/FileUploader",
  () => ({
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
            onFileUpload({
              target: { files: [] },
            } as unknown as React.ChangeEvent<HTMLInputElement>)
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
  }),
);

vi.mock("../../../pages/ExperimentBuilder/components/Timeline/Actions", () => ({
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

vi.mock(
  "../../../pages/ExperimentBuilder/components/Timeline/PublishExperiment",
  () => ({
    default: (props: any) => ({
      handlePublishToGitHub: async () => {
        props.setIsPublishing(true);
        props.setAvailableStorages(["googledrive", "osf"]);
        props.setLastPagesUrl("https://pages.test/exp-123");
        props.setPublishStatus("Ready to publish");
        props.setShowStorageModal(true);
      },
      publishWithStorage: async (uid: string, storage: string) => {
        hoistedMocks.publishWithStorageSpy(uid, storage);
        props.setPublishStatus(`Published with ${storage}`);
        props.setShowStorageModal(false);
        props.setIsPublishing(false);
      },
    }),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/Timeline/StorageSelectModal",
  () => ({
    StorageSelectModal: ({
      isOpen,
      availableStorages,
      onConfirm,
      onCancel,
    }: any) =>
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
  }),
);

export function renderTimeline() {
  const file = {
    name: "stimulus.png",
    url: "/stimulus.png",
    type: "image/png",
  };
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

export function setClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

export function installLocalStorage() {
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

export const mocks = hoistedMocks;
