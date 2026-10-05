export type ManagedMediaAssets = { audio?: string[]; video?: string[] };
export type ManagedAudioPlayer = {
  load(): Promise<void>;
  play(): void | Promise<void>;
  stop(): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void;
  dispose(): void;
};
export type AudioPlayerFactory = (
  url: string,
  context: AudioContext | null,
) => ManagedAudioPlayer;
export type ManagedMediaAPI = {
  reserve(assets: ManagedMediaAssets, active?: boolean): () => void;
  trackElements(container: HTMLElement): () => void;
  beginManualPreload(): void;
  has(type: "audio" | "video", url: string): boolean;
  isDisposed(): boolean;
  dispose(): void;
  stats(): { audio: number; video: number; users: number; pending: number };
};
