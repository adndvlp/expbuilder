import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Model } from "survey-core";
import {
  ensurePreviewSketchpadStyles,
  renderPreviewButtonComponent,
  renderPreviewFileUploadComponent,
  renderPreviewHtmlComponent,
  renderPreviewImageComponent,
  renderPreviewInputComponent,
  renderPreviewSketchpadComponent,
  renderPreviewSliderComponent,
  renderPreviewSurveyContainer,
  renderPreviewTextComponent,
  renderPreviewVideoComponent,
  renderRuntimeCopy,
  resolvePreviewParam,
} from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/runtimePreviewDom";
import { TrialComponent } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

function canvasContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: String(text).length * 8 })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    lineJoin: "round",
    lineCap: "round",
    lineWidth: 1,
    font: "",
    fillStyle: "",
    strokeStyle: "",
    textAlign: "center",
    textBaseline: "middle",
  };
}

class MockImage {
  naturalWidth = 320;
  naturalHeight = 180;
  width = 320;
  height = 180;
  complete = true;
  draggable = false;
  onload: null | (() => void) = null;
  private source = "";

  set src(value: string) {
    this.source = value;
    this.onload?.();
  }

  get src() {
    return this.source;
  }
}

function config(overrides: Record<string, unknown> = {}) {
  return {
    name: "preview",
    coordinates: { source: "typed", value: { x: 25, y: -25 } },
    zIndex: { source: "typed", value: 3 },
    ...overrides,
  };
}

function trialComponent(
  type: TrialComponent["type"],
  overrides: Partial<TrialComponent> = {},
): TrialComponent {
  return {
    id: `${type}-id`,
    type,
    x: 50,
    y: 60,
    width: 200,
    height: 100,
    config: {},
    ...overrides,
  };
}

const canvasStyles = {
  backgroundColor: "#ffffff",
  width: 800,
  height: 600,
  fullScreen: false,
  progressBar: false,
};

beforeEach(() => {
  (Model.prototype as any).applyTheme = vi.fn();
  Object.defineProperty(Model.prototype, "onValidateQuestion", {
    configurable: true,
    get: () => ({ add: vi.fn() }),
  });
  vi.stubGlobal("Image", MockImage);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    canvasContext() as any,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  document.head.querySelector("#sketchpad-styles")?.remove();
});

export {
  MockImage,
  Model,
  TrialComponent,
  afterEach,
  beforeEach,
  canvasContext,
  canvasStyles,
  config,
  describe,
  ensurePreviewSketchpadStyles,
  expect,
  it,
  renderPreviewButtonComponent,
  renderPreviewFileUploadComponent,
  renderPreviewHtmlComponent,
  renderPreviewImageComponent,
  renderPreviewInputComponent,
  renderPreviewSketchpadComponent,
  renderPreviewSliderComponent,
  renderPreviewSurveyContainer,
  renderPreviewTextComponent,
  renderPreviewVideoComponent,
  renderRuntimeCopy,
  resolvePreviewParam,
  trialComponent,
  vi,
};
