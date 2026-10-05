import { createStandaloneMediaServices } from "./standaloneMediaServices";
import type {
  RuntimePluginClass,
  RuntimePluginInstance,
  RuntimeMediaTrial,
  MediaPreparationRuntime,
  MediaPreparationServices,
} from "./mediaPreparationTypes";

// Self-contained: serialized into generated experiments. Keep dependencies inside
// the function and prepare only values already resolved by jsPsych/on_start.
export function createMediaPreparation(
  jsPsych: MediaPreparationRuntime,
  library: { url?: string; type?: string }[],
  services?: MediaPreparationServices,
  fallbackFactory = createStandaloneMediaServices,
) {
  services ||= fallbackFactory(jsPsych, library);
  const owners = new Set<() => void>();
  const completions = new WeakMap<object, () => void>();
  const wrapped = new Map<RuntimePluginClass, RuntimePluginClass>();
  const plugins = new WeakMap<object, RuntimePluginInstance>();
  const wrapType = (Original: RuntimePluginClass) => {
    if (wrapped.has(Original)) return wrapped.get(Original)!;
    const Prepared = class {
      constructor(runtime: unknown) {
        const plugin = new Original(runtime);
        plugins.set(this, plugin);
        if (typeof plugin.simulate === "function") {
          Object.assign(this, {
            simulate: (
              trial: RuntimeMediaTrial,
              mode: string,
              options: unknown,
              onLoad: () => void,
            ) =>
              mode === "data-only"
                ? plugin.simulate!(trial, mode, options, onLoad)
                : this.execute(
                    trial,
                    () => plugin.simulate!(trial, mode, options, onLoad),
                    undefined,
                    jsPsych.getDisplayElement?.(),
                  ),
          });
        }
      }
      async execute(
        trial: RuntimeMediaTrial,
        invoke: () => unknown,
        onLoad?: () => void,
        display?: HTMLElement,
      ) {
        const description = jsPsych.getCurrentTrial();
        let finish!: () => void;
        const finished = new Promise<void>((resolve) => {
          finish = resolve;
        });
        completions.set(description, finish);
        const timeoutMs =
          typeof trial.asset_preload_timeout === "number"
            ? trial.asset_preload_timeout
            : 10000;
        const assets = services!.collect(trial);
        const releaseMedia = jsPsych.pluginAPI.expBuilderMedia?.reserve(
          assets,
          true,
        );
        const releaseElements = display
          ? jsPsych.pluginAPI.expBuilderMedia?.trackElements(display)
          : undefined;
        const images = services!.reserveImages(assets.images, timeoutMs);
        const controller = new AbortController();
        let retired = false;
        const release = () => {
          if (retired) return;
          retired = true;
          controller.abort();
          releaseElements?.();
          releaseMedia?.();
          images.release();
          finish();
        };
        const cleanup = () => {
          owners.delete(release);
          completions.delete(description);
          release();
        };
        let returnedResult = false;
        owners.add(release);
        try {
          await Promise.all([
            images.ready,
            services!.prepareAV(assets, timeoutMs, controller.signal),
          ]);
          if (retired) return;
          const result = invoke();
          if (
            result instanceof Promise ||
            (result &&
              typeof (result as { then?: unknown }).then === "function")
          ) {
            const data = await result;
            returnedResult = true;
            // Return data to jsPsych first; its on_finish completes the ownership scope.
            void finished.then(cleanup);
            return data;
          }
          onLoad?.();
          await finished; // jsPsych's finishTrial wins the result race for sync plugins.
        } finally {
          if (!returnedResult) cleanup();
        }
      }
      trial(
        display: HTMLElement,
        trial: RuntimeMediaTrial,
        onLoad: () => void,
      ) {
        let loaded = false;
        const load = () => {
          if (!loaded) {
            loaded = true;
            onLoad();
          }
        };
        return this.execute(
          trial,
          () => plugins.get(this)!.trial(display, trial, load),
          load,
          display,
        );
      }
    };
    Object.defineProperty(Prepared, "info", { value: Original.info });
    const preparedType = Prepared as unknown as RuntimePluginClass;
    wrapped.set(Original, preparedType);
    return preparedType;
  };
  const install = (
    nodes: RuntimeMediaTrial[],
    inheritedType?: RuntimePluginClass,
  ) => {
    for (const node of nodes) {
      const type = node.type ?? inheritedType;
      if (Array.isArray(node.timeline)) {
        install(node.timeline, type);
        continue;
      }
      if (type?.info?.name === "preload") {
        const onStart = node.on_start;
        node.on_start = function (trial) {
          jsPsych.pluginAPI.expBuilderMedia?.beginManualPreload();
          return onStart?.call(this, trial);
        };
      }
      if (!type?.info || ["plugin-dynamic", "preload"].includes(type.info.name))
        continue;
      node.type = wrapType(type);
      const onFinish = node.on_finish;
      node.on_finish = async function (data: unknown) {
        try {
          return await onFinish?.call(this, data);
        } finally {
          completions.get(node)?.();
        }
      };
    }
  };
  return {
    install,
    dispose: () => {
      for (const release of owners) release();
      owners.clear();
      jsPsych.pluginAPI.expBuilderMedia?.dispose();
    },
  };
}
