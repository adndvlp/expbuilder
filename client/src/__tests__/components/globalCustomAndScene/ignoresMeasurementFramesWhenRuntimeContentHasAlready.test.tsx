import { render } from "@testing-library/react";
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
