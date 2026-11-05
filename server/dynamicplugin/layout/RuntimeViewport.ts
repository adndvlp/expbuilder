import type { ViewportSize } from "../../../shared/dynamic-layout/geometry";
import {
  DESIGN_SIZE,
  fitScene,
  type SceneFit,
} from "../../../shared/dynamic-layout/scene";

type HostRect = ViewportSize & { left: number; top: number };
export type RuntimeViewport = ViewportSize &
  SceneFit & {
    logicalSize: ViewportSize;
    hostRect: HostRect;
    sceneRect: HostRect;
    dpr: number;
    revision: number;
  };
export type LayoutContext = {
  getViewport(): RuntimeViewport;
  getHostElement?(): HTMLElement;
};

function snapshot(
  hostRect: HostRect,
  dpr: number,
  revision: number,
): RuntimeViewport {
  const fit = fitScene(hostRect, dpr) ?? {
    scale: 0,
    offsetX: 0,
    offsetY: 0,
    displayWidth: 0,
    displayHeight: 0,
    rasterScale: 0,
  };
  return {
    ...DESIGN_SIZE,
    ...fit,
    logicalSize: DESIGN_SIZE,
    hostRect,
    dpr,
    revision,
    sceneRect: {
      left: hostRect.left + fit.offsetX,
      top: hostRect.top + fit.offsetY,
      width: fit.displayWidth,
      height: fit.displayHeight,
    },
  };
}

export function getViewport(config: any): RuntimeViewport {
  return (
    config.__layoutContext?.getViewport() ??
    snapshot(
      { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight },
      window.devicePixelRatio || 1,
      0,
    )
  );
}

export function styleHost(element: HTMLElement, viewport: RuntimeViewport) {
  const rect = viewport.hostRect;
  Object.assign(element.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    overflow: "hidden",
    textAlign: "left",
  });
}

export function styleSurface(
  element: HTMLElement,
  viewport: RuntimeViewport,
  origin: { left: number; top: number },
  position: "fixed" | "absolute" = "fixed",
) {
  Object.assign(element.style, {
    position,
    left: `${origin.left + viewport.offsetX}px`,
    top: `${origin.top + viewport.offsetY}px`,
    width: `${viewport.width}px`,
    height: `${viewport.height}px`,
    transform: `scale(${viewport.scale})`,
    transformOrigin: "top left",
    overflow: "hidden",
    textAlign: "left",
    containerType: "size",
  });
}

/** One measurement owner per trial. Layout changes never restart presentation. */
export class RuntimeViewportController implements LayoutContext {
  private snapshot: RuntimeViewport;
  private frame: number | null = null;
  private observer: ResizeObserver;
  private disposed = false;
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void>;
  private dprQuery: MediaQueryList | null = null;
  origin = { left: 0, top: 0 };

  constructor(
    private jsPsych: any,
    private content: HTMLElement,
    private apply: (
      viewport: RuntimeViewport,
      origin: { left: number; top: number },
    ) => void,
  ) {
    this.snapshot = snapshot(
      { left: 0, top: 0, width: 0, height: 0 },
      window.devicePixelRatio || 1,
      0,
    );
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.observer = new ResizeObserver(this.queue);
    const root = this.jsPsych.getDisplayContainerElement();
    for (const element of new Set([root, content, content.parentElement])) {
      if (element) this.observer.observe(element);
    }
    window.addEventListener("resize", this.queue);
    window.addEventListener("scroll", this.queue, true);
    document.addEventListener("fullscreenchange", this.queue);
    this.watchDpr();
    this.measure();
  }

  getViewport = () => this.snapshot;
  ready = () => this.readyPromise;
  refresh = () => this.measure();
  // Some browser emulation/zoom changes omit the media-query notification.
  // Reuse the trial's existing frame loop instead of starting another loop.
  checkDpr = () => {
    if ((window.devicePixelRatio || 1) !== this.snapshot.dpr) this.onDpr();
  };

  private watchDpr() {
    this.dprQuery?.removeEventListener("change", this.onDpr);
    this.dprQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio || 1}dppx)`,
    );
    this.dprQuery.addEventListener("change", this.onDpr);
  }
  private onDpr = () => {
    this.watchDpr();
    this.queue();
  };
  private queue = () => {
    if (this.disposed || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.measure();
    });
  };

  private measure() {
    if (this.disposed) return;
    const root = this.jsPsych.getDisplayContainerElement() as HTMLElement;
    if (!root.getClientRects().length || !this.content.getClientRects().length)
      return;
    const wrapper = this.content.parentElement ?? root;
    const bounds = wrapper.getBoundingClientRect();
    const rootBounds = root.getBoundingClientRect();
    const fullWindow =
      root === document.body || root === document.documentElement;
    const height =
      bounds.height || (fullWindow ? window.innerHeight : rootBounds.height);
    const availableWidth =
      bounds.width || (fullWindow ? window.innerWidth : rootBounds.width);
    const maxWidth = Number(this.jsPsych.getInitSettings()?.experiment_width);
    const width =
      maxWidth > 0 ? Math.min(maxWidth, availableWidth) : availableWidth;
    if (!(width > 0 && height > 0)) return;
    const origin = {
      left: bounds.left + (availableWidth - width) / 2,
      top: bounds.top,
    };
    const dpr = window.devicePixelRatio || 1;
    const previous = this.snapshot;
    if (
      width === previous.hostRect.width &&
      height === previous.hostRect.height &&
      dpr === previous.dpr &&
      origin.left === this.origin.left &&
      origin.top === this.origin.top
    )
      return;
    this.origin = origin;
    this.snapshot = snapshot(
      { ...origin, width, height },
      dpr,
      previous.revision + 1,
    );
    this.apply(this.snapshot, this.origin);
    this.readyResolve?.();
    this.readyResolve = null;
  }

  dispose() {
    this.disposed = true;
    this.observer.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    window.removeEventListener("resize", this.queue);
    window.removeEventListener("scroll", this.queue, true);
    document.removeEventListener("fullscreenchange", this.queue);
    this.dprQuery?.removeEventListener("change", this.onDpr);
    this.readyResolve = null;
  }
}
