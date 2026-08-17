export type FakeAudioContextOptions = {
  currentTime?: number;
  baseLatency?: number;
  outputTimestamp?: {
    contextTime: number;
    performanceTime: number;
  } | null;
};

export type FakeAudioBufferSource = {
  buffer: any;
  startArgs: number[];
  stopArgs: number[];
  connectedTo: any;
  onended: (() => void) | null;
  start: (when?: number) => void;
  stop: (when?: number) => void;
  connect: (node: any) => void;
};

/**
 * Deterministic AudioContext double for AudioTiming tests.
 */
export function createFakeAudioContext(options: FakeAudioContextOptions = {}) {
  const now = () => performance.now();
  const sources: FakeAudioBufferSource[] = [];
  const decoded: any[] = [];

  const context: any = {
    currentTime: options.currentTime ?? 0.5,
    baseLatency: options.baseLatency ?? 0.01,
    state: "running",
    destination: { id: "destination" },
    createdSources: sources,
    decodedBuffers: decoded,
    _outputTimestamp:
      options.outputTimestamp === undefined
        ? {
            contextTime: options.currentTime ?? 0.5,
            performanceTime: now(),
          }
        : options.outputTimestamp,
    getOutputTimestamp() {
      return this._outputTimestamp;
    },
    createBufferSource() {
      const source: FakeAudioBufferSource = {
        buffer: null,
        startArgs: [],
        stopArgs: [],
        connectedTo: null,
        onended: null,
        start(when?: number) {
          this.startArgs.push(when ?? -1);
        },
        stop(when?: number) {
          this.stopArgs.push(when ?? -1);
        },
        connect(node: any) {
          this.connectedTo = node;
        },
      };
      sources.push(source);
      return source;
    },
    decodeAudioData(_arrayBuffer: ArrayBuffer): Promise<any> {
      const buffer = { duration: 1, _arrayBuffer };
      decoded.push(buffer);
      return Promise.resolve(buffer);
    },
    resume() {
      this.state = "running";
      return Promise.resolve();
    },
  };

  return context;
}

export function makeAudioContextUnavailable() {
  const original = (window as any).AudioContext;
  (window as any).AudioContext = undefined;
  return () => {
    (window as any).AudioContext = original;
  };
}
