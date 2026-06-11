type CanvasStageOptions = {
  width: number;
  height: number;
  backgroundColor?: string;
  zIndex?: number;
};

type CanvasDrawable = {
  id: string;
  zIndex?: number;
  visible?: boolean;
  draw: (ctx: CanvasRenderingContext2D) => void;
};

const CANVAS_STAGE_KEY = "__dynamicCanvasStage";

export class CanvasStage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number;
  width: number;
  height: number;
  backgroundColor: string;
  private drawables = new Map<string, Required<CanvasDrawable>>();

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
      alpha: true,
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
    if (!backgroundColor || backgroundColor === "transparent") {
      this.ctx.clearRect(0, 0, this.width, this.height);
      return;
    }

    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  registerDrawable(drawable: CanvasDrawable) {
    this.drawables.set(drawable.id, {
      id: drawable.id,
      zIndex: drawable.zIndex ?? 0,
      visible: drawable.visible ?? false,
      draw: drawable.draw,
    });
    this.render();

    return () => {
      this.removeDrawable(drawable.id);
    };
  }

  updateDrawable(drawable: CanvasDrawable) {
    const existing = this.drawables.get(drawable.id);
    this.drawables.set(drawable.id, {
      id: drawable.id,
      zIndex: drawable.zIndex ?? existing?.zIndex ?? 0,
      visible: drawable.visible ?? existing?.visible ?? false,
      draw: drawable.draw,
    });
    this.render();
  }

  setDrawableVisibility(id: string, visible: boolean) {
    const drawable = this.drawables.get(id);
    if (!drawable || drawable.visible === visible) return;
    drawable.visible = visible;
    this.render();
  }

  removeDrawable(id: string) {
    if (!this.drawables.delete(id)) return;
    this.render();
  }

  render() {
    this.clear(this.backgroundColor);
    const visibleDrawables = [...this.drawables.values()]
      .filter((drawable) => drawable.visible)
      .sort((a, b) => a.zIndex - b.zIndex);

    for (const drawable of visibleDrawables) {
      drawable.draw(this.ctx);
    }
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
