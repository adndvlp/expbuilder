import { afterEach, vi } from "vitest";
import type {
  CanvasStyles,
  TrialComponent,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const canvasStyles: CanvasStyles = {
  backgroundColor: "#ffffff",
  width: 1000,
  height: 800,
  fullScreen: true,
  progressBar: false,
};

function installCanvasContext() {
  const context = {
    canvas: document.createElement("canvas"),
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    textAlign: "center",
    textBaseline: "middle",
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({}) as ImageData),
    putImageData: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: Math.max(1, text.length * 10),
    })),
  } as unknown as CanvasRenderingContext2D;

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context,
  );
  return context;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function component(
  type: TrialComponent["type"],
  config: Record<string, any>,
): TrialComponent {
  return {
    id: `${type}-1`,
    type,
    x: 500,
    y: 400,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: 0,
    config,
  };
}

function installImageStub(complete: boolean) {
  class PreviewImage {
    draggable = true;
    naturalWidth = 64;
    naturalHeight = 32;
    width = 64;
    height = 32;
    onload: (() => void) | null = null;
    complete = complete;
    private currentSrc = "";

    set src(value: string) {
      this.currentSrc = value;
      if (this.complete) this.onload?.();
    }

    get src() {
      return this.currentSrc;
    }
  }

  vi.stubGlobal("Image", PreviewImage as unknown as typeof Image);
}

export { canvasStyles, component, installCanvasContext, installImageStub };
export type { CanvasStyles, TrialComponent };
