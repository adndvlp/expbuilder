export type PreparedAssets = Record<"images" | "audio" | "video", string[]> &
  Record<string, string[]>;
export type RuntimePluginInstance = {
  trial(
    display: HTMLElement,
    trial: RuntimeMediaTrial,
    onLoad: () => void,
  ): unknown;
  simulate?(
    trial: RuntimeMediaTrial,
    mode: string,
    options: unknown,
    onLoad: () => void,
  ): unknown;
};
export type RuntimePluginClass = {
  new (runtime: unknown): RuntimePluginInstance;
  readonly info: { name: string; parameters: Record<string, unknown> };
};
export type RuntimeMediaTrial = Record<string, unknown> & {
  type?: RuntimePluginClass;
  timeline?: RuntimeMediaTrial[];
  on_finish?: (data: unknown) => unknown;
};
export type MediaPreparationRuntime = {
  getCurrentTrial(): object;
  pluginAPI: {
    getAutoPreloadList(trials: RuntimeMediaTrial[]): PreparedAssets;
    getVideoBuffer?(url: string): unknown;
    preloadAudio(
      urls: string[],
      complete: () => void,
      load: () => void,
      error: (error: unknown) => void,
    ): void;
    preloadVideo(
      urls: string[],
      complete: () => void,
      load: () => void,
      error: (error: unknown) => void,
    ): void;
  };
};
export type MediaPreparationServices = {
  collect(trial: RuntimeMediaTrial): PreparedAssets;
  reserveImages(
    urls: string[],
    timeoutMs: number,
  ): { ready: Promise<unknown>; release(): void };
  prepareAV(
    assets: PreparedAssets,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<unknown>;
};
