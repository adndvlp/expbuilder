import { render, screen, waitFor } from "@testing-library/react";
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
});
