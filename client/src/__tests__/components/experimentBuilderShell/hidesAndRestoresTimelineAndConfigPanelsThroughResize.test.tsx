import { fireEvent, render, screen } from "@testing-library/react";
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

  it("hides and restores timeline and config panels through resize handles", () => {
    const { container } = render(<ExperimentBuilder />);
    let resizeHandles = container.querySelectorAll<HTMLElement>(
      'div[style*="col-resize"]',
    );

    fireEvent.mouseDown(resizeHandles[0]);
    fireEvent.mouseMove(document, { clientX: 120 });
    fireEvent.mouseUp(document);

    expect(screen.queryByTestId("timeline")).not.toBeInTheDocument();

    const timelineToggle = Array.from(
      container.querySelectorAll<HTMLElement>(".canvas-header div"),
    ).find((node) => node.style.left === "0px");
    fireEvent.click(timelineToggle!);
    expect(screen.getByTestId("timeline")).toBeInTheDocument();

    resizeHandles = container.querySelectorAll<HTMLElement>(
      'div[style*="col-resize"]',
    );
    fireEvent.mouseDown(resizeHandles[1]);
    fireEvent.mouseMove(document, { clientX: 900 });
    fireEvent.mouseUp(document);

    expect(screen.queryByTestId("configuration-panel")).not.toBeInTheDocument();

    const configToggle = Array.from(
      container.querySelectorAll<HTMLElement>(".canvas-header div"),
    ).find((node) => node.style.right === "0px");
    fireEvent.click(configToggle!);
    expect(screen.getByTestId("configuration-panel")).toBeInTheDocument();
  });
});
