import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExperimentalHtmlSceneLayer from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/ExperimentalHtmlSceneLayer";
import type {
  CanvasStyles,
  TrialComponent,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

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

vi.mock(
  "../../../pages/ExperimentBuilder/components/monacoJsPsychContext",
  () => ({
    setupMonacoJsPsychContext: mocks.setupMonacoJsPsychContext,
    updateCustomPluginContext: mocks.updateCustomPluginContext,
  }),
);

vi.mock("../../../pages/ExperimentBuilder/hooks/useDevMode", () => ({
  default: () => ({
    ...mocks.devMode,
    setCustomInitJsPsychParam: mocks.setCustomInitJsPsychParam,
    setCustomPreInitCode: mocks.setCustomPreInitCode,
  }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/usePlugins", () => ({
  default: () => ({ plugins: mocks.plugins }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useCanvasStyles", () => ({
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

vi.mock("../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
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
});
