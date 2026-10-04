import { vi } from "vitest";
import { getCanvasStage } from "../../../../../server/dynamicplugin/renderer/CanvasStage";

type Resource = { kind: string; id: number };

export function createGpuHarness() {
  let sequence = 0;
  const live = new Set<Resource>();
  const allocate = (kind: string) => {
    const resource = { kind, id: ++sequence };
    live.add(resource);
    return resource;
  };
  const factory = (kind: string) =>
    vi.fn<() => Resource | null>(() => allocate(kind));
  const remove = (resource: Resource | null) => {
    if (resource) live.delete(resource);
  };
  const loseContext = vi.fn();
  const gl = {
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    TEXTURE_2D: 3553,
    TEXTURE0: 33984,
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    QUERY_RESULT_AVAILABLE: 34919,
    QUERY_RESULT: 34918,
    createTexture: factory("texture"),
    createBuffer: factory("buffer"),
    createProgram: factory("program"),
    createShader: factory("shader"),
    createQuery: factory("query"),
    deleteTexture: vi.fn(remove),
    deleteBuffer: vi.fn(remove),
    deleteProgram: vi.fn(remove),
    deleteShader: vi.fn(remove),
    deleteQuery: vi.fn(remove),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => "shader compilation failed"),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => "program linking failed"),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({})),
    getQueryParameter: vi.fn(() => false),
    getParameter: vi.fn(() => false),
    isContextLost: vi.fn(() => false),
    getExtension: vi.fn((name: string) =>
      name === "WEBGL_lose_context"
        ? { loseContext }
        : name === "EXT_disjoint_timer_query_webgl2"
          ? { TIME_ELAPSED_EXT: 35007, GPU_DISJOINT_EXT: 36795 }
          : null,
    ),
    bindTexture: vi.fn((_target: number, resource: Resource | null) => {
      if (resource && !live.has(resource)) {
        throw new Error("Attempted to bind a deleted texture");
      }
    }),
    bindBuffer: vi.fn(),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    bufferData: vi.fn(),
    pixelStorei: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    viewport: vi.fn(),
    useProgram: vi.fn(),
    uniform2f: vi.fn(),
    uniform4f: vi.fn(),
    uniform1i: vi.fn(),
    enable: vi.fn(),
    blendFunc: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    activeTexture: vi.fn(),
    drawArrays: vi.fn(),
    beginQuery: vi.fn(),
    endQuery: vi.fn(),
  };
  vi.stubGlobal("WebGL2RenderingContext", Object);
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(((type: string) =>
      type === "2d"
        ? {
            clearRect() {},
            fillRect() {},
            getImageData: () => ({ data: [0, 0, 0, 0] }),
          }
        : gl) as unknown as typeof HTMLCanvasElement.prototype.getContext);
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const createStage = () =>
    getCanvasStage(parent, { width: 320, height: 240, recordGpuTiming: true });
  const source = () =>
    ({ width: 8, height: 8, close: vi.fn() }) as unknown as ImageBitmap;
  const sprite = (id: string, textureKey: string) => ({
    id,
    textureKey,
    x: 0,
    y: 0,
    width: 8,
    height: 8,
    visible: true,
  });
  const counts = () =>
    [...live].reduce<Record<string, number>>((result, resource) => {
      result[resource.kind] = (result[resource.kind] ?? 0) + 1;
      return result;
    }, {});
  return {
    gl,
    live,
    loseContext,
    getContext,
    parent,
    createStage,
    source,
    sprite,
    counts,
  };
}
