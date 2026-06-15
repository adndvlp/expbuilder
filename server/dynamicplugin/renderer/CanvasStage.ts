export type RenderBackendRequest = "webgl-strict";

type CanvasStageOptions = {
  width: number;
  height: number;
  backgroundColor?: string;
  zIndex?: number;
  backend?: RenderBackendRequest;
  recordGpuTiming?: boolean;
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
  timestamp: number;
  commitIndex: number;
  commitDuration: number;
  renderBackend: string;
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
  visual_all_commits_rAF: boolean;
  commit_outside_raf_count: number;
  commit_count: number;
  commit_durations: number[];
  mean_commit_duration: number | null;
  max_commit_duration: number | null;
  draw_call_count: number;
  texture_uploads_during_trial: number;
  buffer_uploads_during_trial: number;
  shader_compiles_during_trial: number;
  webgl_context_lost_count: number;
  gpu_timer_available: boolean;
  gpu_draw_durations: number[];
  mean_gpu_draw_duration: number | null;
  max_gpu_draw_duration: number | null;
  gpu_pending_query_count: number;
  gpu_disjoint_count: number;
};

const CANVAS_STAGE_REGISTRY_KEY = "__dynamicCanvasStages";

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const summarizeDurations = (durations: number[]) => ({
  mean:
    durations.length > 0
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : null,
  max: durations.length > 0 ? Math.max(...durations) : null,
});

function createBaseMetrics(
  requested: RenderBackendRequest,
  backend: string,
  bufferStrategy: string,
): StageMetrics {
  return {
    render_backend_requested: requested,
    render_backend: backend,
    buffer_strategy: bufferStrategy,
    visual_all_commits_rAF: true,
    commit_outside_raf_count: 0,
    commit_count: 0,
    commit_durations: [],
    mean_commit_duration: null,
    max_commit_duration: null,
    draw_call_count: 0,
    texture_uploads_during_trial: 0,
    buffer_uploads_during_trial: 0,
    shader_compiles_during_trial: 0,
    webgl_context_lost_count: 0,
    gpu_timer_available: false,
    gpu_draw_durations: [],
    mean_gpu_draw_duration: null,
    max_gpu_draw_duration: null,
    gpu_pending_query_count: 0,
    gpu_disjoint_count: 0,
  };
}

function parseCssColor(color: string): RgbaColor {
  const scratch = document.createElement("canvas");
  scratch.width = 1;
  scratch.height = 1;
  const ctx = scratch.getContext("2d");
  if (!ctx) return [0, 0, 0, 1];
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = color || "transparent";
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255, a / 255];
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

abstract class BaseStage {
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
    this.backgroundRgba = parseCssColor(this.backgroundColor);
    this.metrics = createBaseMetrics(
      "webgl-strict",
      backend,
      bufferStrategy,
    );
  }

  setZIndex(zIndex: number) {
    this.canvas.style.zIndex = String(zIndex);
  }

  setTrialActive(active: boolean) {
    this.trialActive = active;
  }

  registerSprite(sprite: SpriteDrawable) {
    this.drawables.set(sprite.id, {
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
    });
    this.markDirty();

    return () => {
      this.removeDrawable(sprite.id);
    };
  }

  registerRect(rect: RectDrawable) {
    this.drawables.set(rect.id, {
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
    });
    this.markDirty();

    return () => {
      this.removeDrawable(rect.id);
    };
  }

  setDrawableVisibility(
    id: string,
    visible: boolean,
    onCommit?: (info: StageCommitInfo) => void,
  ) {
    const drawable = this.drawables.get(id);
    if (!drawable) return;
    if (onCommit) {
      this.pendingVisibilityCommits.push({ id, visible, callback: onCommit });
    }
    if (drawable.visible === visible) return;
    drawable.visible = visible;
    this.markDirty();
  }

  removeDrawable(id: string) {
    if (!this.drawables.delete(id)) return;
    this.markDirty();
  }

  render() {
    this.markDirty();
    if (!this.trialActive) {
      this.commit(performance.now(), false);
    }
  }

  commit(timestamp: number, fromAnimationFrame = false): StageCommitInfo | null {
    if (this.trialActive && !fromAnimationFrame) {
      this.metrics.visual_all_commits_rAF = false;
      this.metrics.commit_outside_raf_count += 1;
    }

    if (!this.dirty && this.pendingVisibilityCommits.length === 0) {
      this.pollGpuQueries();
      return null;
    }

    const startedAt = performance.now();
    const drawCalls = this.renderFrame(timestamp);
    const endedAt = performance.now();
    const duration = round3(endedAt - startedAt);
    this.metrics.commit_count += 1;
    this.metrics.commit_durations.push(duration);
    this.metrics.draw_call_count += drawCalls;
    const commitSummary = summarizeDurations(this.metrics.commit_durations);
    this.metrics.mean_commit_duration =
      commitSummary.mean === null ? null : round3(commitSummary.mean);
    this.metrics.max_commit_duration =
      commitSummary.max === null ? null : round3(commitSummary.max);
    this.dirty = false;
    this.pollGpuQueries();

    const info: StageCommitInfo = {
      timestamp,
      commitIndex: this.metrics.commit_count,
      commitDuration: duration,
      renderBackend: this.metrics.render_backend,
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
    const commitSummary = summarizeDurations(this.metrics.commit_durations);
    const gpuSummary = summarizeDurations(this.metrics.gpu_draw_durations);
    return {
      ...this.metrics,
      mean_commit_duration:
        commitSummary.mean === null ? null : round3(commitSummary.mean),
      max_commit_duration:
        commitSummary.max === null ? null : round3(commitSummary.max),
      mean_gpu_draw_duration:
        gpuSummary.mean === null ? null : round3(gpuSummary.mean),
      max_gpu_draw_duration:
        gpuSummary.max === null ? null : round3(gpuSummary.max),
      gpu_pending_query_count: this.metrics.gpu_pending_query_count,
      commit_durations: [...this.metrics.commit_durations],
      gpu_draw_durations: [...this.metrics.gpu_draw_durations],
    };
  }

  destroy() {
    this.canvas.remove();
  }

  abstract preloadTexture(
    key: string,
    source: CanvasImageSource,
  ): string | null;

  protected abstract renderFrame(timestamp: number): number;

  protected getTextureSource(_key: string): CanvasImageSource | undefined {
    return undefined;
  }

  protected markDirty() {
    this.dirty = true;
  }

  protected getVisibleDrawables() {
    return [...this.drawables.values()]
      .filter((drawable) => drawable.visible)
      .sort((a, b) => a.zIndex - b.zIndex);
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
    this.uniformResolution = gl.getUniformLocation(this.program, "u_resolution");
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
    if (this.textures.has(key)) return key;
    const texture = this.uploadTexture(source);
    this.textures.set(key, texture);
    return key;
  }

  protected getTextureSource(key: string) {
    return this.textureSources.get(key);
  }

  protected renderFrame() {
    const gl = this.gl;
    const query = this.beginGpuQuery();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.uniform2f(this.uniformResolution, this.width, this.height);
    this.clearGl();

    let drawCalls = 0;
    for (const drawable of this.getVisibleDrawables()) {
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
        this.metrics.gpu_draw_durations.push(round3(ns / 1_000_000));
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
    return texture;
  }

  private uploadTextureForKey(key: string, source: CanvasImageSource) {
    const texture = this.uploadTexture(source);
    this.textureSources.set(key, source);
    this.textures.set(key, texture);
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
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source,
    );
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
    if (options.zIndex !== undefined) {
      existing.setZIndex(
        Math.max(Number(existing.canvas.style.zIndex) || 0, options.zIndex),
      );
    }
    return existing;
  }

  const stage: CanvasStage = new WebGLStage(parent, options);
  registry.set(key, stage);
  return stage;
}

export function getCanvasStages(parent: HTMLElement): CanvasStage[] {
  const registry = (parent as any)[CANVAS_STAGE_REGISTRY_KEY] as
    | Map<string, CanvasStage>
    | undefined;
  return registry ? [...registry.values()] : [];
}
