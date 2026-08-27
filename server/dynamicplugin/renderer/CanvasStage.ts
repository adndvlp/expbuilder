export type RenderBackendRequest = "webgl-strict";

export type GpuPrepareSyncMode = "none" | "fence" | "finish";

export interface GpuPrepareSyncResult {
  mode: GpuPrepareSyncMode;
  /**
   * True only when the driver acknowledged the GPU work (fence signaled).
   * `finish`/`none` never claim physical completion.
   */
  confirmed: boolean;
  durationMs: number;
  error: string | null;
}

type CanvasStageOptions = {
  width: number;
  height: number;
  backgroundColor?: string;
  zIndex?: number;
  backend?: RenderBackendRequest;
  recordGpuTiming?: boolean;
  recordCommitSeries?: boolean;
  recordGpuSeries?: boolean;
  /**
   * Prepare-time GPU synchronization. `fence` uses WebGL2 fenceSync with a
   * bounded clientWaitSync; `finish` uses gl.finish(). Both run ONLY during
   * preparation, never inside the critical rAF tick. Defaults to `none` (the
   * sync cost must be benchmarked before it becomes a default).
   */
  gpuPrepareSync?: GpuPrepareSyncMode;
};

type SpriteDrawable = {
  id: string;
  textureKey: string;
  source?: CanvasImageSource;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  visible?: boolean;
  opacity?: number;
};

type RectDrawable = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  zIndex?: number;
  visible?: boolean;
};

type RgbaColor = [number, number, number, number];

type StageDrawable =
  | (Required<SpriteDrawable> & { kind: "sprite"; opacity: number })
  | (Required<RectDrawable> & { kind: "rect"; colorRgba: RgbaColor });

export type StageCommitInfo = {
  /** rAF/commit frame timestamp this commit is synced to. */
  frameTimestamp: number;
  /** performance.now() immediately before the CPU render pass. */
  cpuCommitStartedAt: number;
  /** performance.now() immediately after the CPU render pass. */
  cpuCommitEndedAt: number;
  commitIndex: number;
  commitDuration: number;
  renderBackend: string;

  /** deprecated V1 alias of frameTimestamp */
  timestamp: number;
};

type PendingVisibilityCommit = {
  id: string;
  visible: boolean;
  callback: (info: StageCommitInfo) => void;
};

export type StageMetrics = {
  render_backend_requested: RenderBackendRequest;
  render_backend: string;
  buffer_strategy: string;
  visual_all_commits_frame_synced: boolean;
  commit_unsynced_count: number;
  visual_all_commits_rAF: boolean;
  commit_outside_raf_count: number;
  commit_count: number;
  commit_durations: number[];
  commit_series_truncated: boolean;
  mean_commit_duration: number | null;
  max_commit_duration: number | null;
  draw_call_count: number;
  texture_uploads_during_trial: number;
  buffer_uploads_during_trial: number;
  shader_compiles_during_trial: number;
  webgl_context_lost_count: number;
  gpu_timer_available: boolean;
  gpu_draw_durations: number[];
  gpu_draw_count: number;
  gpu_series_truncated: boolean;
  mean_gpu_draw_duration: number | null;
  max_gpu_draw_duration: number | null;
  gpu_pending_query_count: number;
  gpu_disjoint_count: number;
  /** Prepare-time GPU synchronization mode used by this stage. */
  gpu_prepare_sync_mode: GpuPrepareSyncMode;
  /** Driver acknowledged the prepare-time GPU work (fence signaled). */
  gpu_prepare_sync_confirmed: boolean | null;
  gpu_prepare_sync_duration_ms: number | null;
  gpu_prepare_sync_error: string | null;
};

const CANVAS_STAGE_REGISTRY_KEY = "__dynamicCanvasStages";
const CANVAS_STAGE_LIST_KEY = "__dynamicCanvasStageList";

/**
 * P1.1 (iteración 7): cursor O(1) de contadores monotónicos. Las métricas de
 * UN trial son el delta entre dos cursores (prepare/activate → boundary) —
 * jamás el acumulado del stage persistente.
 *
 * P0.4 (iteración 7): `snapshotCountersNoPoll()` devuelve este cursor SIN
 * consultar la GPU (sin getQueryParameter/getParameter) y sin copiar arrays.
 */
export type StageMetricCursor = {
  render_backend_requested: RenderBackendRequest;
  render_backend: string;
  buffer_strategy: string;
  commit_count: number;
  commit_duration_sum: number;
  commit_duration_max: number | null;
  draw_call_count: number;
  texture_uploads: number;
  buffer_uploads: number;
  shader_compiles: number;
  webgl_context_lost_count: number;
  commit_unsynced_count: number;
  gpu_timer_available: boolean;
  gpu_draw_count: number;
  gpu_duration_sum: number;
  gpu_duration_max: number | null;
  gpu_pending_query_count: number;
  gpu_disjoint_count: number;
  gpu_prepare_sync_mode: GpuPrepareSyncMode;
  gpu_prepare_sync_confirmed: boolean | null;
  gpu_prepare_sync_duration_ms: number | null;
  gpu_prepare_sync_error: string | null;
  /** Sequence index of the NEXT commit series entry (monotonic). */
  commit_series_next_index: number;
  gpu_series_next_index: number;
  commit_series_truncated: boolean;
  gpu_series_truncated: boolean;
};

export type StageMetricSeriesSlice = {
  commitDurations: number[];
  gpuDrawDurations: number[];
  truncated: boolean;
};

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const MAX_METRIC_SERIES_LENGTH = 4096;
const MAX_UNUSED_TEXTURE_CACHE_ENTRIES = 64;
/** 10 ms bounded prepare-time GPU wait (clientWaitSync timeout is in ns). */
const GPU_PREPARE_SYNC_TIMEOUT_NS = 10_000_000;

export interface GpuPrepareSyncGl {
  finish?: () => void;
  fenceSync?: (condition: number, flags: number) => unknown;
  clientWaitSync?: (sync: unknown, flags: number, timeoutNs: number) => number;
  deleteSync?: (sync: unknown) => void;
  ALREADY_SIGNALED?: number;
  CONDITION_SATISFIED?: number;
  SYNC_FLUSH_COMMANDS_BIT?: number;
  SYNC_GPU_COMMANDS_COMPLETE?: number;
}

/**
 * P1.3: pure prepare-time GPU synchronization logic. Extractable and
 * unit-testable without a real GL context. `confirmed === true` ONLY when a
 * fence signaled; `finish` and `none` guarantee "issued", never completion.
 */
export function runGpuPrepareSync(
  gl: GpuPrepareSyncGl,
  mode: GpuPrepareSyncMode,
): Omit<GpuPrepareSyncResult, "durationMs"> {
  if (mode === "none") {
    return { mode, confirmed: false, error: null };
  }
  try {
    if (mode === "finish") {
      gl.finish?.();
      return { mode, confirmed: false, error: null };
    }
    const fence = gl.fenceSync;
    const wait = gl.clientWaitSync;
    const remove = gl.deleteSync;
    if (
      typeof fence !== "function" ||
      typeof wait !== "function" ||
      typeof remove !== "function" ||
      typeof gl.SYNC_GPU_COMMANDS_COMPLETE !== "number" ||
      typeof gl.SYNC_FLUSH_COMMANDS_BIT !== "number"
    ) {
      return { mode, confirmed: false, error: "fence_unavailable_requires_webgl2" };
    }
    const sync = fence(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      return { mode, confirmed: false, error: "fence_creation_failed" };
    }
    const result = wait(
      sync,
      gl.SYNC_FLUSH_COMMANDS_BIT,
      GPU_PREPARE_SYNC_TIMEOUT_NS,
    );
    const confirmed =
      result === gl.ALREADY_SIGNALED || result === gl.CONDITION_SATISFIED;
    remove(sync);
    return {
      mode,
      confirmed,
      error: confirmed ? null : "fence_not_signaled_within_timeout",
    };
  } catch (error) {
    return {
      mode,
      confirmed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const pushBounded = (series: number[], value: number): boolean => {
  if (series.length >= MAX_METRIC_SERIES_LENGTH) {
    series.shift();
    series.push(value);
    return true;
  }
  series.push(value);
  return false;
};

function createBaseMetrics(
  requested: RenderBackendRequest,
  backend: string,
  bufferStrategy: string,
): StageMetrics {
  return {
    render_backend_requested: requested,
    render_backend: backend,
    buffer_strategy: bufferStrategy,
    visual_all_commits_frame_synced: true,
    commit_unsynced_count: 0,
    visual_all_commits_rAF: true,
    commit_outside_raf_count: 0,
    commit_count: 0,
    commit_durations: [],
    commit_series_truncated: false,
    mean_commit_duration: null,
    max_commit_duration: null,
    draw_call_count: 0,
    texture_uploads_during_trial: 0,
    buffer_uploads_during_trial: 0,
    shader_compiles_during_trial: 0,
    webgl_context_lost_count: 0,
    gpu_timer_available: false,
    gpu_draw_durations: [],
    gpu_draw_count: 0,
    gpu_series_truncated: false,
    mean_gpu_draw_duration: null,
    max_gpu_draw_duration: null,
    gpu_pending_query_count: 0,
    gpu_disjoint_count: 0,
    gpu_prepare_sync_mode: "none",
    gpu_prepare_sync_confirmed: null,
    gpu_prepare_sync_duration_ms: null,
    gpu_prepare_sync_error: null,
  };
}

const parsedCssColorCache = new Map<string, RgbaColor>();

function parseCssColor(color: string): RgbaColor {
  const cacheKey = color || "transparent";
  const cached = parsedCssColorCache.get(cacheKey);
  if (cached) return cached;
  const scratch = document.createElement("canvas");
  scratch.width = 1;
  scratch.height = 1;
  const ctx = scratch.getContext("2d");
  if (!ctx) return [0, 0, 0, 1];
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = cacheKey;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const parsed: RgbaColor = [r / 255, g / 255, b / 255, a / 255];
  parsedCssColorCache.set(cacheKey, parsed);
  return parsed;
}

function createVisibleCanvas(
  parent: HTMLElement,
  options: CanvasStageOptions,
): { canvas: HTMLCanvasElement; dpr: number } {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.id = "jspsych-dynamic-webgl-stage";
  canvas.className = "dynamic-canvas-stage";
  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = `${options.width}px`;
  canvas.style.height = `${options.height}px`;
  canvas.style.display = "block";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = String(options.zIndex ?? 0);
  canvas.width = Math.round(options.width * dpr);
  canvas.height = Math.round(options.height * dpr);
  parent.appendChild(canvas);
  return { canvas, dpr };
}

export abstract class BaseStage {
  canvas: HTMLCanvasElement;
  dpr: number;
  width: number;
  height: number;
  backgroundColor: string;
  protected backgroundRgba: RgbaColor;
  protected drawables = new Map<string, StageDrawable>();
  protected dirty = true;
  protected trialActive = false;
  protected pendingVisibilityCommits: PendingVisibilityCommit[] = [];
  protected metrics: StageMetrics;
  protected gpuResourceCallCount = 0;
  protected gpuPrepareSync: GpuPrepareSyncMode;
  private orderedDrawables: StageDrawable[] = [];
  private visibleDrawables: StageDrawable[] = [];
  private recordCommitSeries: boolean;
  private recordGpuSeries: boolean;
  private commitDurationSum = 0;
  private commitDurationMax: number | null = null;
  private gpuDurationSum = 0;
  private gpuDurationMax: number | null = null;
  // P1.1 (iteración 7): entradas de serie descartadas por el ring acotado —
  // los slices se indexan por secuencia absoluta, no por posición de array.
  private commitSeriesOffset = 0;
  private gpuSeriesOffset = 0;

  constructor(
    parent: HTMLElement,
    options: CanvasStageOptions,
    backend: string,
    bufferStrategy: string,
  ) {
    const visible = createVisibleCanvas(parent, options);
    this.canvas = visible.canvas;
    this.dpr = visible.dpr;
    this.width = options.width;
    this.height = options.height;
    this.backgroundColor = options.backgroundColor || "#ffffff";
    this.recordCommitSeries = options.recordCommitSeries === true;
    this.recordGpuSeries = options.recordGpuSeries === true;
    this.gpuPrepareSync = options.gpuPrepareSync ?? "none";
    this.backgroundRgba = parseCssColor(this.backgroundColor);
    this.metrics = createBaseMetrics("webgl-strict", backend, bufferStrategy);
    this.metrics.gpu_prepare_sync_mode = this.gpuPrepareSync;
  }

  setZIndex(zIndex: number) {
    this.canvas.style.zIndex = String(zIndex);
  }

  setTrialActive(active: boolean) {
    this.trialActive = active;
  }

  setGpuPrepareSync(mode: GpuPrepareSyncMode) {
    this.gpuPrepareSync = mode;
    this.metrics.gpu_prepare_sync_mode = mode;
  }

  setMetricSeriesRecording(commitSeries: boolean, gpuSeries: boolean) {
    this.recordCommitSeries = commitSeries;
    this.recordGpuSeries = gpuSeries;
  }

  resetForTrial() {
    for (const drawable of this.drawables.values()) {
      if (drawable.kind === "sprite") this.releaseTexture(drawable.textureKey);
    }
    this.drawables.clear();
    this.orderedDrawables = [];
    this.visibleDrawables = [];
    this.pendingVisibilityCommits = [];
    this.trialActive = false;
    this.dirty = true;
    this.metrics = createBaseMetrics(
      "webgl-strict",
      this.metrics.render_backend,
      this.metrics.buffer_strategy,
    );
    this.metrics.gpu_prepare_sync_mode = this.gpuPrepareSync;
    this.commitDurationSum = 0;
    this.commitDurationMax = null;
    this.gpuDurationSum = 0;
    this.gpuDurationMax = null;
    this.commitSeriesOffset = 0;
    this.gpuSeriesOffset = 0;
  }

  registerSprite(sprite: SpriteDrawable) {
    this.removeDrawable(sprite.id);
    const drawable: StageDrawable = {
      kind: "sprite",
      id: sprite.id,
      textureKey: sprite.textureKey,
      source: sprite.source ?? this.getTextureSource(sprite.textureKey),
      x: sprite.x,
      y: sprite.y,
      width: sprite.width,
      height: sprite.height,
      zIndex: sprite.zIndex ?? 0,
      visible: sprite.visible ?? false,
      opacity: sprite.opacity ?? 1,
    };
    this.drawables.set(sprite.id, drawable);
    this.retainTexture(drawable.textureKey);
    this.insertByZIndex(this.orderedDrawables, drawable);
    if (drawable.visible) {
      this.insertByZIndex(this.visibleDrawables, drawable);
      this.markDirty();
    }

    // P0.4 (iteración 7): el disposer retira rápido — la expulsión real de
    // textura ocurre en runTextureMaintenance (no-responseSafe).
    return () => {
      this.removeDrawableFast(sprite.id);
    };
  }

  registerRect(rect: RectDrawable) {
    this.removeDrawable(rect.id);
    const drawable: StageDrawable = {
      kind: "rect",
      id: rect.id,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      color: rect.color,
      colorRgba: parseCssColor(rect.color),
      zIndex: rect.zIndex ?? 0,
      visible: rect.visible ?? false,
    };
    this.drawables.set(rect.id, drawable);
    this.insertByZIndex(this.orderedDrawables, drawable);
    if (drawable.visible) {
      this.insertByZIndex(this.visibleDrawables, drawable);
      this.markDirty();
    }

    // P0.4 (iteración 7): retiro rápido; la expulsión real ocurre en
    // runTextureMaintenance (no-responseSafe).
    return () => {
      this.removeDrawableFast(rect.id);
    };
  }

  setDrawableVisibility(
    id: string,
    visible: boolean,
    onCommit?: (info: StageCommitInfo) => void,
  ) {
    const drawable = this.drawables.get(id);
    if (!drawable) return;
    // A no-op has no physical commit to attribute. Never leave its callback
    // queued for an unrelated future frame.
    if (drawable.visible === visible) return;
    if (onCommit) {
      this.pendingVisibilityCommits.push({ id, visible, callback: onCommit });
    }
    drawable.visible = visible;
    if (visible) {
      this.insertByZIndex(this.visibleDrawables, drawable);
    } else {
      this.removeFromOrdered(this.visibleDrawables, drawable);
    }
    this.markDirty();
  }

  removeDrawable(id: string) {
    const drawable = this.drawables.get(id);
    if (!drawable || !this.drawables.delete(id)) return;
    this.pendingVisibilityCommits = this.pendingVisibilityCommits.filter(
      (event) => event.id !== id,
    );
    if (drawable.kind === "sprite") this.releaseTexture(drawable.textureKey);
    this.removeFromOrdered(this.orderedDrawables, drawable);
    this.removeFromOrdered(this.visibleDrawables, drawable);
    if (drawable.visible) this.markDirty();
  }

  render() {
    this.markDirty();
    if (!this.trialActive) {
      this.commit(performance.now(), false);
    }
  }

  commit(frameTimestamp: number, frameSynced = false): StageCommitInfo | null {
    if (this.trialActive && !frameSynced) {
      this.metrics.visual_all_commits_frame_synced = false;
      this.metrics.commit_unsynced_count += 1;
      // V1 compatibility aliases
      this.metrics.visual_all_commits_rAF = false;
      this.metrics.commit_outside_raf_count += 1;
    }

    if (!this.dirty && this.pendingVisibilityCommits.length === 0) {
      this.pollGpuQueries();
      return null;
    }

    const cpuCommitStartedAt = performance.now();
    const drawCalls = this.renderFrame(frameTimestamp);
    const cpuCommitEndedAt = performance.now();
    const duration = round3(cpuCommitEndedAt - cpuCommitStartedAt);
    this.metrics.commit_count += 1;
    this.commitDurationSum += duration;
    this.commitDurationMax = Math.max(
      this.commitDurationMax ?? duration,
      duration,
    );
    if (this.recordCommitSeries) {
      const truncated = pushBounded(this.metrics.commit_durations, duration);
      this.metrics.commit_series_truncated =
        truncated || this.metrics.commit_series_truncated;
      if (truncated) this.commitSeriesOffset += 1;
    }
    this.metrics.draw_call_count += drawCalls;
    this.metrics.mean_commit_duration = round3(
      this.commitDurationSum / this.metrics.commit_count,
    );
    this.metrics.max_commit_duration = round3(this.commitDurationMax);
    this.dirty = false;
    this.pollGpuQueries();

    const info: StageCommitInfo = {
      frameTimestamp,
      cpuCommitStartedAt,
      cpuCommitEndedAt,
      commitIndex: this.metrics.commit_count,
      commitDuration: duration,
      renderBackend: this.metrics.render_backend,
      timestamp: frameTimestamp,
    };
    const pending = this.pendingVisibilityCommits;
    this.pendingVisibilityCommits = [];
    for (const event of pending) {
      const drawable = this.drawables.get(event.id);
      if (drawable && drawable.visible === event.visible) {
        event.callback(info);
      }
    }
    return info;
  }

  getMetrics(): StageMetrics {
    this.pollGpuQueries();
    return {
      ...this.metrics,
      gpu_pending_query_count: this.metrics.gpu_pending_query_count,
      commit_durations: [...this.metrics.commit_durations],
      gpu_draw_durations: [...this.metrics.gpu_draw_durations],
    };
  }

  /**
   * P0.4 (iteración 7): snapshot de contadores monotónicos O(1) para PHASE R.
   * NO consulta la GPU (sin getQueryParameter/getParameter) y NO copia
   * arrays de series. Los valores medios/máximos se derivan de los sums
   * acumulados y de los slices acotados.
   */
  snapshotCountersNoPoll(): StageMetricCursor {
    return {
      render_backend_requested: this.metrics.render_backend_requested,
      render_backend: this.metrics.render_backend,
      buffer_strategy: this.metrics.buffer_strategy,
      commit_count: this.metrics.commit_count,
      commit_duration_sum: this.commitDurationSum,
      commit_duration_max: this.commitDurationMax,
      draw_call_count: this.metrics.draw_call_count,
      texture_uploads: this.metrics.texture_uploads_during_trial,
      buffer_uploads: this.metrics.buffer_uploads_during_trial,
      shader_compiles: this.metrics.shader_compiles_during_trial,
      webgl_context_lost_count: this.metrics.webgl_context_lost_count,
      commit_unsynced_count: this.metrics.commit_unsynced_count,
      gpu_timer_available: this.metrics.gpu_timer_available,
      gpu_draw_count: this.metrics.gpu_draw_count,
      gpu_duration_sum: this.gpuDurationSum,
      gpu_duration_max: this.gpuDurationMax,
      gpu_pending_query_count: this.metrics.gpu_pending_query_count,
      gpu_disjoint_count: this.metrics.gpu_disjoint_count,
      gpu_prepare_sync_mode: this.metrics.gpu_prepare_sync_mode,
      gpu_prepare_sync_confirmed: this.metrics.gpu_prepare_sync_confirmed,
      gpu_prepare_sync_duration_ms: this.metrics.gpu_prepare_sync_duration_ms,
      gpu_prepare_sync_error: this.metrics.gpu_prepare_sync_error,
      commit_series_next_index:
        this.commitSeriesOffset + this.metrics.commit_durations.length,
      gpu_series_next_index:
        this.gpuSeriesOffset + this.metrics.gpu_draw_durations.length,
      commit_series_truncated: this.metrics.commit_series_truncated,
      gpu_series_truncated: this.metrics.gpu_series_truncated,
    };
  }

  /**
   * P1.1 (iteración 7): slice acotado por secuencia [from, to) — sólo el
   * tramo que pertenece a UN trial. `truncated` indica que el ring acotado
   * ya no retenía parte del tramo.
   */
  getMetricSeriesSlice(
    commitFrom: number,
    commitTo: number,
    gpuFrom: number,
    gpuTo: number,
  ): StageMetricSeriesSlice {
    const commitStart = Math.max(0, commitFrom - this.commitSeriesOffset);
    const commitEnd = Math.min(
      this.metrics.commit_durations.length,
      Math.max(0, commitTo - this.commitSeriesOffset),
    );
    const gpuStart = Math.max(0, gpuFrom - this.gpuSeriesOffset);
    const gpuEnd = Math.min(
      this.metrics.gpu_draw_durations.length,
      Math.max(0, gpuTo - this.gpuSeriesOffset),
    );
    const truncated =
      commitFrom < this.commitSeriesOffset || gpuFrom < this.gpuSeriesOffset;
    return {
      commitDurations:
        commitStart <= commitEnd
          ? this.metrics.commit_durations.slice(commitStart, commitEnd)
          : [],
      gpuDrawDurations:
        gpuStart <= gpuEnd
          ? this.metrics.gpu_draw_durations.slice(gpuStart, gpuEnd)
          : [],
      truncated,
    };
  }

  /**
   * P0.4 (iteración 7): retiro rápido de drawables — quita la referencia del
   * runtime activo y decrementa la referencia lógica de textura SIN evictar
   * (sin gl.deleteTexture, sin ordenamientos). La expulsión real ocurre en
   * `runTextureMaintenance()` (tarea no-responseSafe).
   */
  removeDrawableFast(id: string) {
    const drawable = this.drawables.get(id);
    if (!drawable || !this.drawables.delete(id)) return;
    this.pendingVisibilityCommits = this.pendingVisibilityCommits.filter(
      (event) => event.id !== id,
    );
    if (drawable.kind === "sprite") this.releaseTextureFast(drawable.textureKey);
    this.removeFromOrdered(this.orderedDrawables, drawable);
    this.removeFromOrdered(this.visibleDrawables, drawable);
    if (drawable.visible) this.markDirty();
  }

  /**
   * P0.4 (iteración 7): expulsión real de texturas (gl.deleteTexture,
   * filtrado/ordenación del cache) — NUNCA dentro de una tarea
   * response-safe. El plugin la agenda como tarea no-responseSafe tras
   * PHASE R.
   */
  runTextureMaintenance(): void {
    this.evictUnusedTextures();
  }

  protected releaseTextureFast(_key: string) {}

  /** Overridden by GPU stages; no-op for non-retained backends. */
  protected evictUnusedTextures() {}

  destroy() {
    for (const drawable of this.drawables.values()) {
      if (drawable.kind === "sprite") this.releaseTexture(drawable.textureKey);
    }
    this.drawables.clear();
    this.orderedDrawables = [];
    this.visibleDrawables = [];
    this.pendingVisibilityCommits = [];
    this.canvas.remove();
  }

  getResourceDiagnostics() {
    return {
      drawableCount: this.drawables.size,
      pendingVisibilityCallbacks: this.pendingVisibilityCommits.length,
      gpuResourceCallCount: this.gpuResourceCallCount,
    };
  }

  getGpuResourceCallCount() {
    return this.gpuResourceCallCount;
  }

  abstract preloadTexture(
    key: string,
    source: CanvasImageSource,
  ): string | null;

  /** True only when `key` already has a resident GPU texture on this stage. */
  abstract isTextureResident(key: string): boolean;

  /**
   * P1.3: prepare-time GPU synchronization. Must ONLY run during preparation,
   * never inside the critical rAF tick. `fence` (WebGL2) can CONFIRM driver
   * completion; `finish` and `none` only guarantee the commands were issued.
   */
  abstract syncGpuForPrepare(): GpuPrepareSyncResult;

  protected abstract renderFrame(timestamp: number): number;

  protected getTextureSource(_key: string): CanvasImageSource | undefined {
    return undefined;
  }

  protected retainTexture(_key: string) {}

  protected releaseTexture(_key: string) {}

  protected markDirty() {
    this.dirty = true;
  }

  protected getOrderedDrawables() {
    return this.visibleDrawables;
  }

  private insertByZIndex(target: StageDrawable[], drawable: StageDrawable) {
    let low = 0;
    let high = target.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (target[middle].zIndex <= drawable.zIndex) low = middle + 1;
      else high = middle;
    }
    target.splice(low, 0, drawable);
  }

  private removeFromOrdered(target: StageDrawable[], drawable: StageDrawable) {
    const index = target.indexOf(drawable);
    if (index >= 0) target.splice(index, 1);
  }

  protected pollGpuQueries() {
    // Implemented by WebGLStage.
  }
}

class WebGLStage extends BaseStage {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  private textures = new Map<string, WebGLTexture>();
  private textureSources = new Map<string, CanvasImageSource>();
  private textureUsage = new Map<string, { references: number; lastUsed: number }>();
  private textureUseSequence = 0;
  private whiteTexture: WebGLTexture;
  private uniformResolution: WebGLUniformLocation | null;
  private uniformRect: WebGLUniformLocation | null;
  private uniformTexture: WebGLUniformLocation | null;
  private uniformColor: WebGLUniformLocation | null;
  private attributePosition: number;
  private attributeTexCoord: number;
  private gpuTimerExt: any = null;
  private pendingGpuQueries: any[] = [];

  constructor(parent: HTMLElement, options: CanvasStageOptions) {
    super(
      parent,
      { ...options, backend: "webgl-strict" },
      "webgl",
      "webgl-retained-sprites",
    );
    const gl =
      this.canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      }) ||
      this.canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      });

    if (!gl) {
      throw new Error("WebGL is not available");
    }

    this.gl = gl;
    this.gpuTimerExt =
      options.recordGpuTiming !== false &&
      "WebGL2RenderingContext" in window &&
      gl instanceof WebGL2RenderingContext
        ? gl.getExtension("EXT_disjoint_timer_query_webgl2")
        : null;
    this.metrics.gpu_timer_available = !!this.gpuTimerExt;
    this.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.metrics.webgl_context_lost_count += 1;
    });

    this.program = this.createProgram();
    this.positionBuffer = this.createBuffer(
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
    );
    this.texCoordBuffer = this.createBuffer(
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
    );
    this.whiteTexture = this.createWhiteTexture();
    this.attributePosition = gl.getAttribLocation(this.program, "a_position");
    this.attributeTexCoord = gl.getAttribLocation(this.program, "a_texCoord");
    this.uniformResolution = gl.getUniformLocation(
      this.program,
      "u_resolution",
    );
    this.uniformRect = gl.getUniformLocation(this.program, "u_rect");
    this.uniformTexture = gl.getUniformLocation(this.program, "u_texture");
    this.uniformColor = gl.getUniformLocation(this.program, "u_color");
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.uniform2f(this.uniformResolution, this.width, this.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.clearGl();
  }

  preloadTexture(key: string, source: CanvasImageSource) {
    this.textureSources.set(key, source);
    const usage = this.textureUsage.get(key) ?? {
      references: 0,
      lastUsed: 0,
    };
    usage.lastUsed = ++this.textureUseSequence;
    this.textureUsage.set(key, usage);
    if (this.textures.has(key)) return key;
    const texture = this.uploadTexture(source);
    this.textures.set(key, texture);
    this.evictUnusedTextures();
    return key;
  }

  isTextureResident(key: string) {
    return this.textures.has(key);
  }

  /**
   * P1.3: bounded prepare-time GPU synchronization. Runs only from the
   * preparation phase (before markReady), never inside a rAF tick.
   */
  syncGpuForPrepare(): GpuPrepareSyncResult {
    const startedAt = performance.now();
    const result = runGpuPrepareSync(this.gl, this.gpuPrepareSync);
    const durationMs =
      result.mode === "none" ? 0 : Math.max(0, performance.now() - startedAt);
    this.metrics.gpu_prepare_sync_mode = result.mode;
    this.metrics.gpu_prepare_sync_confirmed = result.confirmed;
    this.metrics.gpu_prepare_sync_duration_ms = round3(durationMs);
    this.metrics.gpu_prepare_sync_error = result.error;
    return { ...result, durationMs: round3(durationMs) };
  }

  protected getTextureSource(key: string) {
    return this.textureSources.get(key);
  }

  protected retainTexture(key: string) {
    const usage = this.textureUsage.get(key) ?? {
      references: 0,
      lastUsed: 0,
    };
    usage.references += 1;
    usage.lastUsed = ++this.textureUseSequence;
    this.textureUsage.set(key, usage);
  }

  protected releaseTexture(key: string) {
    const usage = this.textureUsage.get(key);
    if (!usage) return;
    usage.references = Math.max(0, usage.references - 1);
    usage.lastUsed = ++this.textureUseSequence;
    this.evictUnusedTextures();
  }

  /**
   * P0.4 (iteración 7): decremento de referencia lógica SIN expulsión —
   * response-safe. El gl.deleteTexture real queda en runTextureMaintenance.
   */
  protected releaseTextureFast(key: string) {
    const usage = this.textureUsage.get(key);
    if (!usage) return;
    usage.references = Math.max(0, usage.references - 1);
    usage.lastUsed = ++this.textureUseSequence;
  }

  getResourceDiagnostics() {
    return {
      ...super.getResourceDiagnostics(),
      textureCount: this.textures.size,
      retainedTextureReferences: [...this.textureUsage.values()].reduce(
        (sum, usage) => sum + usage.references,
        0,
      ),
      textureCacheLimit: MAX_UNUSED_TEXTURE_CACHE_ENTRIES,
    };
  }

  destroy() {
    super.destroy();
    for (const query of this.pendingGpuQueries) this.gl.deleteQuery?.(query);
    this.pendingGpuQueries = [];
    for (const texture of this.textures.values()) {
      this.gl.deleteTexture?.(texture);
      this.gpuResourceCallCount += 1;
    }
    this.textures.clear();
    this.textureSources.clear();
    this.textureUsage.clear();
    this.gl.deleteTexture?.(this.whiteTexture);
    this.gpuResourceCallCount += 1;
    this.gl.deleteBuffer?.(this.positionBuffer);
    this.gl.deleteBuffer?.(this.texCoordBuffer);
    this.gl.deleteProgram?.(this.program);
  }

  private evictUnusedTextures() {
    const unused = [...this.textureUsage.entries()]
      .filter(([, usage]) => usage.references === 0)
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    while (unused.length > MAX_UNUSED_TEXTURE_CACHE_ENTRIES) {
      const [key] = unused.shift()!;
      const texture = this.textures.get(key);
      if (texture) {
        this.gl.deleteTexture?.(texture);
        this.gpuResourceCallCount += 1;
      }
      this.textures.delete(key);
      this.textureSources.delete(key);
      this.textureUsage.delete(key);
    }
  }

  protected renderFrame() {
    const gl = this.gl;
    const query = this.beginGpuQuery();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.uniform2f(this.uniformResolution, this.width, this.height);
    this.clearGl();

    let drawCalls = 0;
    for (const drawable of this.getOrderedDrawables()) {
      if (!drawable.visible) continue;
      if (drawable.kind === "sprite") {
        const texture =
          this.textures.get(drawable.textureKey) ??
          (drawable.source
            ? this.uploadTextureForKey(drawable.textureKey, drawable.source)
            : null);
        if (texture) {
          this.drawTexturedQuad(
            texture,
            drawable.x,
            drawable.y,
            drawable.width,
            drawable.height,
            [1, 1, 1, drawable.opacity],
          );
          drawCalls += 1;
        }
      } else if (drawable.kind === "rect") {
        this.drawTexturedQuad(
          this.whiteTexture,
          drawable.x,
          drawable.y,
          drawable.width,
          drawable.height,
          drawable.colorRgba,
        );
        drawCalls += 1;
      }
    }
    this.endGpuQuery(query);
    return drawCalls;
  }

  protected pollGpuQueries() {
    if (!this.gpuTimerExt || this.pendingGpuQueries.length === 0) {
      this.metrics.gpu_pending_query_count = this.pendingGpuQueries.length;
      return;
    }
    const gl = this.gl as WebGL2RenderingContext;
    const remaining: any[] = [];
    for (const query of this.pendingGpuQueries) {
      const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
      const disjoint = gl.getParameter(this.gpuTimerExt.GPU_DISJOINT_EXT);
      if (disjoint) {
        this.metrics.gpu_disjoint_count += 1;
        gl.deleteQuery(query);
        continue;
      }
      if (available) {
        const ns = gl.getQueryParameter(query, gl.QUERY_RESULT);
        const duration = round3(ns / 1_000_000);
        this.metrics.gpu_draw_count += 1;
        this.gpuDurationSum += duration;
        this.gpuDurationMax = Math.max(
          this.gpuDurationMax ?? duration,
          duration,
        );
        this.metrics.mean_gpu_draw_duration = round3(
          this.gpuDurationSum / this.metrics.gpu_draw_count,
        );
        this.metrics.max_gpu_draw_duration = round3(this.gpuDurationMax);
        if (this.recordGpuSeries) {
          const truncated = pushBounded(this.metrics.gpu_draw_durations, duration);
          this.metrics.gpu_series_truncated =
            truncated || this.metrics.gpu_series_truncated;
          if (truncated) this.gpuSeriesOffset += 1;
        }
        gl.deleteQuery(query);
      } else {
        remaining.push(query);
      }
    }
    this.pendingGpuQueries = remaining;
    this.metrics.gpu_pending_query_count = remaining.length;
  }

  private createShader(type: number, source: string) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Could not create WebGL shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (this.trialActive) {
      this.metrics.shader_compiles_during_trial += 1;
    }
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "Unknown shader error";
      gl.deleteShader(shader);
      throw new Error(log);
    }
    return shader;
  }

  private createProgram() {
    const gl = this.gl;
    const vertexShader = this.createShader(
      gl.VERTEX_SHADER,
      `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      uniform vec2 u_resolution;
      uniform vec4 u_rect;
      varying vec2 v_texCoord;

      void main() {
        vec2 pixelPosition = u_rect.xy + a_position * u_rect.zw;
        vec2 zeroToOne = pixelPosition / u_resolution;
        vec2 zeroToTwo = zeroToOne * 2.0;
        vec2 clipSpace = zeroToTwo - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        v_texCoord = a_texCoord;
      }
    `,
    );
    const fragmentShader = this.createShader(
      gl.FRAGMENT_SHADER,
      `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform vec4 u_color;
      varying vec2 v_texCoord;

      void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord) * u_color;
      }
    `,
    );
    const program = gl.createProgram();
    if (!program) throw new Error("Could not create WebGL program");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (this.trialActive) {
      this.metrics.shader_compiles_during_trial += 1;
    }
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) || "Unknown WebGL link error";
      throw new Error(log);
    }
    return program;
  }

  private createBuffer(data: Float32Array) {
    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error("Could not create WebGL buffer");
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
    if (this.trialActive) {
      this.metrics.buffer_uploads_during_trial += 1;
    }
    return buffer;
  }

  private createWhiteTexture() {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("Could not create WebGL texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]),
    );
    this.gpuResourceCallCount += 2;
    return texture;
  }

  private uploadTextureForKey(key: string, source: CanvasImageSource) {
    const texture = this.uploadTexture(source);
    this.textureSources.set(key, source);
    this.textures.set(key, texture);
    // registerSprite() retains before the first lazy upload. Preserve that
    // reference count so an in-use texture can never be selected by LRU
    // eviction merely because its GPU upload happened on the first draw.
    const usage = this.textureUsage.get(key) ?? {
      references: 0,
      lastUsed: 0,
    };
    usage.lastUsed = ++this.textureUseSequence;
    this.textureUsage.set(key, usage);
    this.evictUnusedTextures();
    return texture;
  }

  private uploadTexture(source: CanvasImageSource) {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("Could not create WebGL texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.gpuResourceCallCount += 2;
    if (this.trialActive) {
      this.metrics.texture_uploads_during_trial += 1;
    }
    return texture;
  }

  private drawTexturedQuad(
    texture: WebGLTexture,
    x: number,
    y: number,
    width: number,
    height: number,
    color: [number, number, number, number],
  ) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.attributePosition);
    gl.vertexAttribPointer(this.attributePosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.attributeTexCoord);
    gl.vertexAttribPointer(this.attributeTexCoord, 2, gl.FLOAT, false, 0, 0);

    gl.uniform4f(this.uniformRect, x, y, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.uniformTexture, 0);
    gl.uniform4f(this.uniformColor, color[0], color[1], color[2], color[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private clearGl() {
    const gl = this.gl;
    const [r, g, b, a] = this.backgroundRgba;
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  private beginGpuQuery() {
    if (!this.gpuTimerExt) return null;
    const gl = this.gl as WebGL2RenderingContext;
    const query = gl.createQuery();
    if (!query) return null;
    gl.beginQuery(this.gpuTimerExt.TIME_ELAPSED_EXT, query);
    return query;
  }

  private endGpuQuery(query: WebGLQuery | null) {
    if (!this.gpuTimerExt || !query) return;
    const gl = this.gl as WebGL2RenderingContext;
    gl.endQuery(this.gpuTimerExt.TIME_ELAPSED_EXT);
    this.pendingGpuQueries.push(query);
  }
}

export type CanvasStage = BaseStage;

function getStageRegistry(parent: HTMLElement) {
  let registry = (parent as any)[CANVAS_STAGE_REGISTRY_KEY] as
    | Map<string, CanvasStage>
    | undefined;
  if (!registry) {
    registry = new Map<string, CanvasStage>();
    Object.defineProperty(parent, CANVAS_STAGE_REGISTRY_KEY, {
      value: registry,
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(parent, CANVAS_STAGE_LIST_KEY, {
      value: [] as CanvasStage[],
      enumerable: false,
      configurable: true,
    });
  }
  return registry;
}

export function getCanvasStage(
  parent: HTMLElement,
  options: CanvasStageOptions,
): CanvasStage {
  const requested = options.backend ?? "webgl-strict";
  if (requested !== "webgl-strict") {
    throw new Error(`Unsupported Dynamic visual renderer: ${requested}`);
  }
  const registry = getStageRegistry(parent);
  const key = "webgl-strict";
  const existing = registry.get(key);
  if (existing) {
    existing.setMetricSeriesRecording(
      options.recordCommitSeries === true,
      options.recordGpuSeries === true,
    );
    existing.setGpuPrepareSync(options.gpuPrepareSync ?? "none");
    if (options.zIndex !== undefined) {
      existing.setZIndex(
        Math.max(Number(existing.canvas.style.zIndex) || 0, options.zIndex),
      );
    }
    return existing;
  }

  const stage: CanvasStage = new WebGLStage(parent, options);
  registry.set(key, stage);
  ((parent as any)[CANVAS_STAGE_LIST_KEY] as CanvasStage[]).push(stage);
  return stage;
}

export function getCanvasStages(parent: HTMLElement): CanvasStage[] {
  // The persistent frame callback calls this on every observed rAF. Keep a
  // stable list beside the registry so a stationary presentation does not
  // allocate a fresh array on every frame.
  return (
    ((parent as any)[CANVAS_STAGE_LIST_KEY] as CanvasStage[] | undefined) ?? []
  );
}
