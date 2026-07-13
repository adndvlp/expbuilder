import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExperimentBuilder from "../../../pages/ExperimentBuilder";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  routeParams: { id: "exp-shell" },
  isDevMode: false,
  isSaveMode: false,
  setDevMode: vi.fn(),
  setSaveMode: vi.fn(),
  uploadedFiles: [
    { name: "asset.png", url: "/uploads/asset.png", type: "image" },
  ],
  handleFileUpload: vi.fn(),
  handleDeleteFile: vi.fn(),
  handleDeleteMultipleFiles: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useParams: () => mocks.routeParams,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("react-switch", () => ({
  default: ({
    id,
    checked,
    onChange,
  }: {
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      aria-label={id}
      data-checked={String(checked)}
      onClick={() => onChange(!checked)}
    />
  ),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useDevMode", () => ({
  default: () => ({
    isDevMode: mocks.isDevMode,
    setDevMode: mocks.setDevMode,
    isSaveMode: mocks.isSaveMode,
    setSaveMode: mocks.setSaveMode,
  }),
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/Timeline/useFileUpload",
  () => ({
    useFileUpload: () => ({
      uploadedFiles: mocks.uploadedFiles,
      fileInputRef: { current: null },
      folderInputRef: { current: null },
      handleFileUpload: mocks.handleFileUpload,
      handleDeleteFile: mocks.handleDeleteFile,
      handleDeleteMultipleFiles: mocks.handleDeleteMultipleFiles,
    }),
  }),
);

vi.mock("../../../pages/ExperimentBuilder/providers/TrialsProvider", () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="trials-provider">{children}</div>
  ),
}));

vi.mock("../../../pages/ExperimentBuilder/providers/UrlProvider", () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="url-provider">{children}</div>
  ),
}));

vi.mock(
  "../../../pages/ExperimentBuilder/providers/CanvasStylesProvider",
  () => ({
    default: ({
      children,
      experimentID,
    }: {
      children: ReactNode;
      experimentID?: string;
    }) => (
      <div
        data-testid="canvas-styles-provider"
        data-experiment-id={experimentID}
      >
        {children}
      </div>
    ),
  }),
);

vi.mock("../../../pages/ExperimentBuilder/components/Timeline", () => ({
  default: (props: any) => (
    <div data-testid="timeline">
      Timeline files {props.uploadedFiles.length}
      <button
        type="button"
        onClick={() => props.handleFileUpload({ target: { files: [] } } as any)}
      >
        Upload From Timeline
      </button>
      <button
        type="button"
        onClick={() => props.handleDeleteFile(props.uploadedFiles[0])}
      >
        Delete From Timeline
      </button>
      <button
        type="button"
        onClick={() => props.handleDeleteMultipleFiles(props.uploadedFiles)}
      >
        Delete Many From Timeline
      </button>
    </div>
  ),
}));

vi.mock("../../../pages/ExperimentBuilder/components/Canvas", () => ({
  default: () => <div data-testid="canvas">Canvas</div>,
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel",
  () => ({
    default: () => <div data-testid="configuration-panel">Configuration</div>,
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ExperimentPreview",
  () => ({
    default: ({ uploadedFiles }: { uploadedFiles: unknown[] }) => (
      <div data-testid="experiment-preview">Preview {uploadedFiles.length}</div>
    ),
  }),
);

vi.mock("../../../pages/ExperimentBuilder/components/CodeEditor", () => ({
  default: () => <div data-testid="code-editor">Code Editor</div>,
}));

vi.mock("../../../pages/ExperimentBuilder/components/GlobalCustomCode", () => ({
  default: () => <div data-testid="global-custom-code">Global Code</div>,
}));

function okJson(payload: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

describe("ExperimentBuilder shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.routeParams = { id: "exp-shell" };
    mocks.isDevMode = false;
    mocks.isSaveMode = false;
    mocks.setDevMode.mockImplementation((value: boolean) => {
      mocks.isDevMode = value;
    });
    mocks.setSaveMode.mockImplementation((value: boolean) => {
      mocks.isSaveMode = value;
    });
    globalThis.fetch = vi.fn(async () =>
      okJson({ experiment: { id: "exp-shell" } }),
    ) as unknown as typeof fetch;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
  });

  it("composes providers, renders normal builder panes, and wires shared file upload props", async () => {
    render(<ExperimentBuilder />);

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/experiment/exp-shell",
      );
    });

    expect(screen.getByTestId("trials-provider")).toBeInTheDocument();
    expect(screen.getByTestId("url-provider")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-styles-provider")).toHaveAttribute(
      "data-experiment-id",
      "exp-shell",
    );
    expect(screen.getByTestId("timeline")).toHaveTextContent(
      "Timeline files 1",
    );
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(screen.getByTestId("configuration-panel")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-preview")).toHaveTextContent(
      "Preview 1",
    );
    expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Upload From Timeline"));
    fireEvent.click(screen.getByText("Delete From Timeline"));
    fireEvent.click(screen.getByText("Delete Many From Timeline"));

    expect(mocks.handleFileUpload).toHaveBeenCalled();
    expect(mocks.handleDeleteFile).toHaveBeenCalledWith(mocks.uploadedFiles[0]);
    expect(mocks.handleDeleteMultipleFiles).toHaveBeenCalledWith(
      mocks.uploadedFiles,
    );

    fireEvent.click(screen.getByText("←"));
    expect(mocks.navigate).toHaveBeenCalledWith(-1);
  });

  it("navigates home when the experiment id is missing or not found", async () => {
    fetchMock().mockResolvedValueOnce(okJson({ experiment: null }, false));

    render(<ExperimentBuilder />);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/home");
    });
  });

  it("renders the dev-mode shell with code editor, preview, and global custom code", () => {
    mocks.isDevMode = true;
    mocks.isSaveMode = true;

    render(<ExperimentBuilder />);

    expect(screen.getByLabelText("devMode")).toHaveAttribute(
      "data-checked",
      "true",
    );
    expect(screen.getByLabelText("saveMode")).toHaveAttribute(
      "data-checked",
      "true",
    );
    expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    expect(screen.getByTestId("global-custom-code")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-preview")).toHaveTextContent(
      "Preview 1",
    );
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
    expect(screen.queryByTestId("configuration-panel")).not.toBeInTheDocument();
  });

  it("wires dev and save mode switches to the dev-mode provider", () => {
    render(<ExperimentBuilder />);

    fireEvent.click(screen.getByLabelText("devMode"));
    fireEvent.click(screen.getByLabelText("saveMode"));

    expect(mocks.setDevMode).toHaveBeenCalledWith(true);
    expect(mocks.setSaveMode).toHaveBeenCalledWith(true);
  });

  it("resizes timeline and config panels while keeping them visible", () => {
    const { container } = render(<ExperimentBuilder />);
    const resizeHandles = container.querySelectorAll<HTMLElement>(
      'div[style*="col-resize"]',
    );

    fireEvent.mouseDown(resizeHandles[0]);
    fireEvent.mouseMove(document, { clientX: 320 });
    fireEvent.mouseUp(document);

    expect(
      container.querySelector<HTMLElement>(".timeline-container"),
    ).toHaveStyle({ width: "320px" });

    fireEvent.mouseDown(resizeHandles[1]);
    fireEvent.mouseMove(document, { clientX: 700 });
    fireEvent.mouseUp(document);

    expect(
      container.querySelector<HTMLElement>(".config-panel-container"),
    ).toHaveStyle({ width: "500px" });
  });
});
