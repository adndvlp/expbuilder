type CanvasStageOptions = {
  width: number;
  height: number;
  backgroundColor?: string;
  zIndex?: number;
};

const CANVAS_STAGE_KEY = "__dynamicCanvasStage";

export class CanvasStage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number;
  width: number;
  height: number;
  backgroundColor: string;

  constructor(parent: HTMLElement, options: CanvasStageOptions) {
    this.dpr = window.devicePixelRatio || 1;
    this.width = options.width;
    this.height = options.height;
    this.backgroundColor = options.backgroundColor || "#ffffff";

    this.canvas = document.createElement("canvas");
    this.canvas.id = "jspsych-dynamic-canvas-stage";
    this.canvas.className = "dynamic-canvas-stage";
    this.canvas.style.position = "absolute";
    this.canvas.style.left = "0";
    this.canvas.style.top = "0";
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.canvas.style.display = "block";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = String(options.zIndex ?? 0);

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    parent.appendChild(this.canvas);

    const ctx = this.canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    } as CanvasRenderingContext2DSettings);

    if (!ctx) {
      throw new Error("Could not create 2D canvas context");
    }

    this.ctx = ctx;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.clear(this.backgroundColor);
  }

  setZIndex(zIndex: number) {
    this.canvas.style.zIndex = String(zIndex);
  }

  clear(backgroundColor = this.backgroundColor) {
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawImage(
    source: CanvasImageSource,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    this.ctx.drawImage(source, x, y, width, height);
  }

  destroy() {
    this.canvas.remove();
  }
}

export function getCanvasStage(
  parent: HTMLElement,
  options: CanvasStageOptions,
): CanvasStage {
  const existing = (parent as any)[CANVAS_STAGE_KEY] as CanvasStage | undefined;
  if (existing) {
    if (options.zIndex !== undefined) {
      existing.setZIndex(
        Math.max(Number(existing.canvas.style.zIndex) || 0, options.zIndex),
      );
    }
    return existing;
  }

  const stage = new CanvasStage(parent, options);
  Object.defineProperty(parent, CANVAS_STAGE_KEY, {
    value: stage,
    enumerable: false,
    configurable: true,
  });
  return stage;
}
