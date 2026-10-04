import type { Page } from "@playwright/test";

type Inventory = {
  textures: number;
  buffers: number;
  programs: number;
  shaders: number;
  losses: number;
  draws: number;
  lost: boolean;
  connected: boolean;
  parent: string | null;
  size: number[];
};

// Count native allocations without replacing the renderer or generated artifact.
export async function installGpuLifetimeProbe(page: Page) {
  await page.addInitScript(() => {
    type Context = WebGLRenderingContext | WebGL2RenderingContext;
    const records = new Map<
      Context,
      {
        resources: Record<string, Set<object>>;
        losses: number;
        draws: number;
      }
    >();
    const record = (gl: Context) => {
      if (
        !(gl.canvas instanceof HTMLCanvasElement) ||
        !gl.canvas.classList.contains("dynamic-canvas-stage")
      )
        return null;
      let entry = records.get(gl);
      if (!entry) {
        entry = {
          resources: Object.fromEntries(
            ["textures", "buffers", "programs", "shaders"].map((key) => [
              key,
              new Set<object>(),
            ]),
          ),
          losses: 0,
          draws: 0,
        };
        records.set(gl, entry);
        const tracked = entry;
        gl.canvas.addEventListener("webglcontextlost", () => {
          tracked.losses++;
        });
      }
      return entry;
    };
    const prototypes = [
      WebGLRenderingContext.prototype,
      WebGL2RenderingContext.prototype,
    ];
    for (const prototype of prototypes) {
      for (const [type, name] of [
        ["textures", "Texture"],
        ["buffers", "Buffer"],
        ["programs", "Program"],
        ["shaders", "Shader"],
      ]) {
        const methods = prototype as unknown as Record<
          string,
          (this: Context, ...args: unknown[]) => unknown
        >;
        const create = methods[`create${name}`];
        const remove = methods[`delete${name}`];
        methods[`create${name}`] = function (...args) {
          const resource = Reflect.apply(create, this, args) as object | null;
          if (resource) record(this)?.resources[type].add(resource);
          return resource;
        };
        methods[`delete${name}`] = function (...args) {
          const result = Reflect.apply(remove, this, args);
          if (args[0]) record(this)?.resources[type].delete(args[0] as object);
          return result;
        };
      }
      const draw = prototype.drawArrays;
      prototype.drawArrays = function (mode, first, count) {
        const entry = record(this);
        if (entry) entry.draws++;
        return draw.call(this, mode, first, count);
      };
    }
    Object.defineProperty(window, "__gpuInventory", {
      value: () =>
        [...records].map(([gl, entry]) => ({
          ...Object.fromEntries(
            Object.entries(entry.resources).map(([key, resources]) => [
              key,
              resources.size,
            ]),
          ),
          losses: entry.losses,
          draws: entry.draws,
          lost: gl.isContextLost(),
          connected: (gl.canvas as HTMLCanvasElement).isConnected,
          parent: (gl.canvas as HTMLCanvasElement).parentElement?.id ?? null,
          size: [gl.canvas.width, gl.canvas.height],
        })),
    });
  });
}

export function gpuInventory(page: Page): Promise<Inventory[]> {
  return page.evaluate(() =>
    (
      window as unknown as {
        __gpuInventory(): Inventory[];
      }
    ).__gpuInventory(),
  );
}
