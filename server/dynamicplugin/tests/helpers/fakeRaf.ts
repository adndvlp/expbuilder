type RafCallback = (timestamp: number) => void;

type QueuedFrame = {
  id: number;
  run: (timestamp: number) => void;
};

let originalRequestAnimationFrame: typeof window.requestAnimationFrame | null = null;
let originalCancelAnimationFrame: typeof window.cancelAnimationFrame | null = null;
let queue: QueuedFrame[] = [];
let handleMap = new Map<number, boolean>();
let nextId = 1;
let installed = false;

/**
 * Installs a controlled requestAnimationFrame queue.
 *
 * `stepRaf(t)` executes all callbacks queued for the next frame with exactly
 * `t`. Callbacks scheduled while processing `stepRaf(t)` belong to the
 * following frame, not the current iteration.
 */
export function installFakeRaf() {
  if (installed) return;
  installed = true;
  queue = [];
  handleMap = new Map<number, boolean>();
  originalRequestAnimationFrame = window.requestAnimationFrame;
  originalCancelAnimationFrame = window.cancelAnimationFrame;
  const anyWindow = window as any;

  anyWindow.requestAnimationFrame = (callback: RafCallback): number => {
    const id = nextId++;
    queue.push({
      id,
      run: (timestamp: number) => {
        if (!handleMap.get(id)) return;
        handleMap.delete(id);
        callback(timestamp);
      },
    });
    handleMap.set(id, true);
    return id;
  };
  anyWindow.cancelAnimationFrame = (id: number): void => {
    handleMap.delete(id);
  };
}

/** Runs the next rAF frame at `timestampMs`, returning the number of callbacks run. */
export function stepRaf(timestampMs: number): number {
  const current = queue;
  queue = [];
  let ran = 0;
  for (const entry of current) {
    entry.run(timestampMs);
    ran += 1;
  }
  return ran;
}

export function pendingRafCount(): number {
  return queue.filter((entry) => handleMap.has(entry.id)).length;
}

export function restoreFakeRaf() {
  if (!installed) return;
  installed = false;
  queue = [];
  handleMap = new Map<number, boolean>();
  if (originalRequestAnimationFrame !== null) {
    (window as any).requestAnimationFrame = originalRequestAnimationFrame;
  }
  if (originalCancelAnimationFrame !== null) {
    (window as any).cancelAnimationFrame = originalCancelAnimationFrame;
  }
  originalRequestAnimationFrame = null;
  originalCancelAnimationFrame = null;
}
