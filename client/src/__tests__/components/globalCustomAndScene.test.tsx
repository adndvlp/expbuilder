import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlobalCustomCode from "../../pages/ExperimentBuilder/components/GlobalCustomCode";
import ExperimentalHtmlSceneLayer from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/ExperimentalHtmlSceneLayer";
import type {
  CanvasStyles,
  TrialComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const mocks = vi.hoisted(() => ({
  plugins: [{ name: "custom-plugin" }],
  setCustomInitJsPsychParam: vi.fn(),
  setCustomPreInitCode: vi.fn(),
  updateCustomPluginContext: vi.fn(),
  setupMonacoJsPsychContext: vi.fn(),
  editorMounts: [] as any[],
  devMode: {
    customInitJsPsychParams: {
      local: {
        on_data_update: "data.existing = true;",
      } as Record<string, string>,
      public: {
        on_finish: "window.publicDone = true;",
      } as Record<string, string>,
    },
    customPreInitCode: {
      local: "window.preExisting = true;",
      public: "",
    },
    setCustomInitJsPsychParam: vi.fn(),
    setCustomPreInitCode: vi.fn(),
  },
}));

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, defaultValue, onChange, onMount, options }: any) => {
    const readOnly = Boolean(options?.readOnly);
    const text = value ?? defaultValue ?? "";
    const mountPayload = {
      getModel: () => ({ getLineCount: () => String(text).split("\n").length }),
      revealLine: vi.fn(),
    };
    mocks.editorMounts.push({ readOnly, text, mountPayload });
    onMount?.(mountPayload, { languages: {} });

    return (
      <textarea
        aria-label={readOnly ? "Monaco readonly editor" : "Monaco editor"}
        readOnly={readOnly}
        value={text}
        onChange={(event) => onChange?.(event.target.value)}
      />
    );
  },
  Editor: ({ value, defaultValue, onChange, onMount, options }: any) => {
    const readOnly = Boolean(options?.readOnly);
    const text = value ?? defaultValue ?? "";
    const mountPayload = {
      getModel: () => ({ getLineCount: () => String(text).split("\n").length }),
      revealLine: vi.fn(),
    };
    mocks.editorMounts.push({ readOnly, text, mountPayload });
    onMount?.(mountPayload, { languages: {} });

    return (
      <textarea
        aria-label={readOnly ? "Monaco readonly editor" : "Monaco editor"}
        readOnly={readOnly}
        value={text}
        onChange={(event) => onChange?.(event.target.value)}
      />
    );
  },
}));

vi.mock("monaco-editor", () => ({}));

vi.mock("../../pages/ExperimentBuilder/components/monacoJsPsychContext", () => ({
  setupMonacoJsPsychContext: mocks.setupMonacoJsPsychContext,
  updateCustomPluginContext: mocks.updateCustomPluginContext,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useDevMode", () => ({
  default: () => ({
    ...mocks.devMode,
    setCustomInitJsPsychParam: mocks.setCustomInitJsPsychParam,
    setCustomPreInitCode: mocks.setCustomPreInitCode,
  }),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/usePlugins", () => ({
  default: () => ({ plugins: mocks.plugins }),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useCanvasStyles", () => ({
  default: () => ({
    canvasStyles: {
      width: 1024,
      height: 768,
      backgroundColor: "#ffffff",
      fullScreen: true,
      progressBar: true,
    },
  }),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => "exp-1",
}));

const canvasStyles: CanvasStyles = {
  width: 640,
  height: 480,
  backgroundColor: "#ffffff",
  fullScreen: true,
  progressBar: false,
};

function trialComponent(
  overrides: Partial<TrialComponent> & Pick<TrialComponent, "id" | "type">,
): TrialComponent {
  return {
    x: 120,
    y: 90,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: 1,
    config: {},
    ...overrides,
  };
}

describe("GlobalCustomCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editorMounts = [];
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the initJsPsych editor, syncs param edits and renders builder previews", async () => {
    render(<GlobalCustomCode />);

    expect(mocks.updateCustomPluginContext).toHaveBeenCalledWith(
      expect.anything(),
      ["custom-plugin"],
    );

    fireEvent.click(screen.getByRole("button", { name: "initJsPsych" }));

    expect(screen.getByText(/progress bar on/)).toBeInTheDocument();
    expect(screen.getByText(/Builder-managed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^on_trial_start/ }));
    expect(
      (screen.getByLabelText("Monaco readonly editor") as HTMLTextAreaElement)
        .value,
    ).toContain("// No user code for this param in local");

    fireEvent.click(screen.getByRole("button", { name: "Public" }));
    await waitFor(() => {
      expect(
        (screen.getByLabelText("Monaco readonly editor") as HTMLTextAreaElement)
          .value,
      ).toContain("on_trial_start");
    });

    fireEvent.click(screen.getByRole("button", { name: /^on_finish\b/ }));

    const editable = screen.getByLabelText("Monaco editor");
    fireEvent.change(editable, {
      target: { value: "data.updated = true;" },
    });

    expect(mocks.setCustomInitJsPsychParam).toHaveBeenCalledWith(
      "local",
      "on_finish",
      "data.updated = true;",
    );

    fireEvent.click(screen.getByRole("button", { name: /^on_data_update\b/ }));
    fireEvent.change(screen.getByLabelText("Monaco editor"), {
      target: { value: "data.updated = true;" },
    });

    expect(mocks.setCustomInitJsPsychParam).toHaveBeenCalledWith(
      "local",
      "on_data_update",
      "data.updated = true;",
    );

    fireEvent.click(screen.getByRole("button", { name: "Local" }));

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Monaco readonly editor") as HTMLTextAreaElement)
          .value,
      ).toContain("data.updated = true;");
    });

    expect(mocks.setupMonacoJsPsychContext).toHaveBeenCalled();
  });

  it("runs save timers and closes init/pre-init modals from controls and backdrop", () => {
    vi.useFakeTimers();
    render(<GlobalCustomCode />);

    fireEvent.click(screen.getByRole("button", { name: "initJsPsych" }));
    fireEvent.change(screen.getByLabelText("Monaco editor"), {
      target: { value: "data.timer = true;" },
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByText("✓ Saved")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const initOverlay = Array.from(document.body.children).find(
      (child) => (child as HTMLElement).style.position === "fixed",
    ) as HTMLElement;
    fireEvent.keyDown(initOverlay.firstElementChild as Element, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "×" }));
    expect(screen.queryByText(/progress bar on/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "initJsPsych" }));
    const initBackdrop = Array.from(document.body.children).find(
      (child) => (child as HTMLElement).style.position === "fixed",
    ) as HTMLElement;
    fireEvent.click(initBackdrop);
    expect(screen.queryByText(/progress bar on/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Before initJsPsych" }));
    const preInitOverlay = Array.from(document.body.children).find(
      (child) => (child as HTMLElement).style.position === "fixed",
    ) as HTMLElement;
    fireEvent.keyDown(preInitOverlay.firstElementChild as Element, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "×" }));
    expect(screen.queryByText(/inside async IIFE/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Before initJsPsych" }));
    const preInitBackdrop = Array.from(document.body.children).find(
      (child) => (child as HTMLElement).style.position === "fixed",
    ) as HTMLElement;
    fireEvent.change(screen.getByLabelText("Monaco editor"), {
      target: { value: "window.preTimer = true;" },
    });
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByText("✓ Saved")).toHaveStyle({ opacity: "1" });
    fireEvent.click(preInitBackdrop);
    expect(screen.queryByText(/inside async IIFE/)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("opens the pre-init editor and stores pre-init code edits", async () => {
    render(<GlobalCustomCode />);

    fireEvent.click(screen.getByRole("button", { name: "Before initJsPsych" }));

    expect(screen.getAllByText("Before initJsPsych")).toHaveLength(2);
    expect(screen.getByText(/inside async IIFE/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Monaco editor"), {
      target: { value: "window.before = true;" },
    });

    expect(mocks.setCustomPreInitCode).toHaveBeenCalledWith(
      "local",
      "window.before = true;",
    );

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Monaco readonly editor") as HTMLTextAreaElement)
          .value,
      ).toContain("window.before = true;");
    });

    fireEvent.click(screen.getByRole("button", { name: "Public" }));

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Monaco readonly editor") as HTMLTextAreaElement)
          .value,
      ).toContain("window.before = true;");
    });
  });
});

describe("ExperimentalHtmlSceneLayer", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders HTML-scene runtime copies with active/selected DOM state and prunes stale metrics", async () => {
    const onMetricsChange = vi.fn();
    const components: TrialComponent[] = [
      trialComponent({
        id: "html-1",
        type: "HtmlComponent",
        x: 200,
        y: 140,
        zIndex: 2,
        config: {
          stimulus: {
            source: "typed",
            value: "<strong data-testid='runtime-html'>Runtime HTML</strong>",
          },
        },
      }),
      trialComponent({
        id: "text-1",
        type: "TextComponent",
        x: 320,
        y: 220,
        zIndex: 3,
        config: {
          text: { source: "typed", value: "Editable text" },
        },
      }),
      trialComponent({
        id: "text-2",
        type: "TextComponent",
        x: 420,
        y: 260,
        zIndex: 4,
        config: {
          text: { source: "typed", value: "Selected text" },
        },
      }),
    ];

    const { container } = render(
      <ExperimentalHtmlSceneLayer
        components={components}
        canvasStyles={canvasStyles}
        stageScale={0.5}
        metrics={{
          "html-1": { width: 220, height: 90 },
          stale: { width: 1, height: 1 },
        }}
        uploadedFiles={[]}
        selectedId="text-2"
        activeDomId="html-1"
        editingTextId="text-1"
        onMetricsChange={onMetricsChange}
      />,
    );

    const overlay = container.querySelector(
      "[data-html-scene-overlay='true']",
    ) as HTMLElement;
    expect(overlay).toHaveStyle({
      width: "640px",
      height: "480px",
      transform: "scale(0.5)",
      zIndex: "5",
    });
    expect(screen.getByTestId("runtime-html")).toBeInTheDocument();

    const htmlNode = container.querySelector(
      "[data-scene-node-id='html-1']",
    ) as HTMLElement;
    expect(htmlNode).toHaveStyle({
      pointerEvents: "auto",
      zIndex: "2",
    });

    const textNode = container.querySelector(
      "[data-scene-node-id='text-1']",
    ) as HTMLElement;
    expect(textNode).toHaveStyle({
      opacity: "0",
      zIndex: "3",
    });

    await waitFor(() => {
      expect(onMetricsChange).toHaveBeenCalledWith({
        "html-1": { width: 220, height: 90 },
      });
    });
  });

  it("does not render when no components are eligible for the HTML scene", () => {
    const { container } = render(
      <ExperimentalHtmlSceneLayer
        components={[
          trialComponent({
            id: "audio-1",
            type: "AudioComponent",
          }),
        ]}
        canvasStyles={canvasStyles}
        stageScale={1}
        metrics={{}}
        uploadedFiles={[]}
        onMetricsChange={vi.fn()}
      />,
    );

    expect(
      container.querySelector("[data-html-scene-overlay='true']"),
    ).toBeNull();
  });

  it("handles default media files, missing component config and an empty runtime host", () => {
    const firstElementChild = vi
      .spyOn(Element.prototype, "firstElementChild", "get")
      .mockReturnValue(null);

    const { container } = render(
      <ExperimentalHtmlSceneLayer
        components={[
          trialComponent({
            id: "text-without-config",
            type: "TextComponent",
            config: undefined as any,
          }),
          trialComponent({
            id: "video-with-default-files",
            type: "VideoComponent",
            config: {
              stimulus: { source: "typed", value: "uploads/clip.mp4" },
            },
          }),
        ]}
        canvasStyles={canvasStyles}
        stageScale={1}
        metrics={{}}
        onMetricsChange={vi.fn()}
      />,
    );

    expect(
      container.querySelector("[data-html-scene-overlay='true']"),
    ).toBeInTheDocument();
    expect(container.querySelector("source")).toHaveAttribute(
      "src",
      expect.stringContaining("uploads/clip.mp4"),
    );
    firstElementChild.mockRestore();
  });

  it("resolves media asset URLs and records changed runtime measurements", async () => {
    const widthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(111);
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(22);
    const onMetricsChange = vi.fn();
    const components: TrialComponent[] = [
      trialComponent({
        id: "image-empty",
        type: "ImageComponent",
        width: 120,
        height: 80,
        config: {
          stimulus: { source: "typed", value: "" },
        },
      }),
      trialComponent({
        id: "video-relative",
        type: "VideoComponent",
        width: 120,
        height: 80,
        config: {
          stimulus: { source: "typed", value: "uploads/relative-only.mp4" },
        },
      }),
      trialComponent({
        id: "video-mapped",
        type: "VideoComponent",
        width: 120,
        height: 80,
        config: {
          stimulus: {
            source: "typed",
            value: ["clip.mp4", "https://cdn.test/direct.mp4"],
          },
        },
      }),
    ];

    const { container, unmount } = render(
      <ExperimentalHtmlSceneLayer
        components={components}
        canvasStyles={canvasStyles}
        stageScale={1}
        metrics={{ "video-relative": { width: 111, height: 22 } }}
        uploadedFiles={[
          { name: "clip.mp4", url: "https://cdn.test/clip.mp4", type: "video" },
        ]}
        onMetricsChange={onMetricsChange}
      />,
    );

    const sources = Array.from(container.querySelectorAll("source")).map(
      (source) => source.getAttribute("src"),
    );
    expect(sources).toEqual(
      expect.arrayContaining([
        expect.stringContaining("uploads/relative-only.mp4"),
        "https://cdn.test/clip.mp4",
        "https://cdn.test/direct.mp4",
      ]),
    );

    await waitFor(() => {
      expect(onMetricsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          "image-empty": { width: 111, height: 22 },
          "video-mapped": { width: 111, height: 22 },
        }),
      );
    });

    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    widthSpy.mockRestore();
    heightSpy.mockRestore();
  });

  it("ignores measurement frames when runtime content has already been removed", () => {
    let scheduledFrame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      scheduledFrame = cb;
      return 42;
    });
    const onMetricsChange = vi.fn();
    const { container, unmount } = render(
      <ExperimentalHtmlSceneLayer
        components={[
          trialComponent({
            id: "html-removed",
            type: "HtmlComponent",
            config: {
              stimulus: { source: "typed", value: "<p>Removed</p>" },
            },
          }),
        ]}
        canvasStyles={canvasStyles}
        stageScale={1}
        metrics={{}}
        uploadedFiles={[]}
        onMetricsChange={onMetricsChange}
      />,
    );

    const host = container.querySelector(
      "[data-scene-node-content='true']",
    ) as HTMLElement;
    host.innerHTML = "";
    scheduledFrame?.(0);

    expect(onMetricsChange).not.toHaveBeenCalled();
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
  });
});
