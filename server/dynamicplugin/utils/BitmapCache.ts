export type CanvasBitmapSource = ImageBitmap | HTMLImageElement;

export type BitmapLease = {
  readonly source: CanvasBitmapSource | null;
  readonly ready: Promise<CanvasBitmapSource>;
  release(): void;
};

type Entry = {
  url: string;
  source: CanvasBitmapSource | null;
  ready: Promise<CanvasBitmapSource> | null;
  controller: AbortController;
  users: number;
  bytes: number;
  lastUse: number;
  priority: number;
};

export function disposeBitmapSource(source: CanvasBitmapSource) {
  if ("close" in source) source.close();
  else {
    source.onload = null;
    source.onerror = null;
    source.removeAttribute("src");
  }
}

export function bitmapCancelled() {
  return new DOMException("Bitmap preparation was cancelled", "AbortError");
}

// Idle capacity is separate from resources protected by components, stages or
// prefetch. Zero means release unused sources; it is not a WebKit RAM threshold.
export class BitmapCache {
  private entries = new Map<string, Entry>();
  private sources = new WeakMap<CanvasImageSource, Entry>();
  private clock = 0;

  constructor(
    private load: (
      url: string,
      signal: AbortSignal,
      timeoutMs: number,
      priority: number,
    ) => Promise<CanvasBitmapSource>,
    private maxIdleBytes = 0,
  ) {
    if (!Number.isFinite(maxIdleBytes) || maxIdleBytes < 0) {
      throw new Error(
        "Bitmap idle capacity must be a finite nonnegative number",
      );
    }
  }

  acquire(url: string, timeoutMs = 10000, priority = 0): BitmapLease {
    let entry = this.entries.get(url);
    if (!entry) entry = this.createEntry(url, timeoutMs, priority);
    const current = entry;
    current.priority = Math.min(current.priority, priority);
    current.users++;
    current.lastUse = ++this.clock;
    let released = false;
    return {
      get source() {
        return released ? null : current.source;
      },
      ready: current.ready!,
      release: () => {
        if (released) return;
        released = true;
        current.users--;
        this.trim();
      },
    };
  }

  retainSource(source: CanvasImageSource): () => void {
    const entry = this.sources.get(source);
    if (!entry) return () => {};
    entry.users++;
    entry.lastUse = ++this.clock;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      entry.users--;
      this.trim();
    };
  }

  snapshot() {
    const entries = [...this.entries.values()];
    return {
      entries: entries.length,
      pending: entries.filter((entry) => !entry.source).length,
      estimatedBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
      idleBytes: entries
        .filter((entry) => entry.users === 0)
        .reduce((total, entry) => total + entry.bytes, 0),
      users: entries.reduce((total, entry) => total + entry.users, 0),
      maxIdleBytes: this.maxIdleBytes,
    };
  }

  private createEntry(url: string, timeoutMs: number, priority: number) {
    const entry: Entry = {
      url,
      source: null,
      ready: null,
      controller: new AbortController(),
      users: 0,
      bytes: 0,
      lastUse: ++this.clock,
      priority,
    };
    this.entries.set(url, entry);
    entry.ready = Promise.resolve()
      .then(() => {
        if (entry.controller.signal.aborted) throw bitmapCancelled();
        return this.load(
          url,
          entry.controller.signal,
          timeoutMs,
          entry.priority,
        );
      })
      .then((source) => {
        if (this.entries.get(url) !== entry) {
          disposeBitmapSource(source);
          throw bitmapCancelled();
        }
        entry.source = source;
        const width =
          "naturalWidth" in source ? source.naturalWidth : source.width;
        const height =
          "naturalHeight" in source ? source.naturalHeight : source.height;
        entry.bytes = width * height * 4;
        this.sources.set(source, entry);
        return source;
      })
      .catch((error) => {
        if (this.entries.get(url) === entry) this.entries.delete(url);
        throw error;
      });
    // Reservations can be cancelled before a preload caller awaits the result.
    void entry.ready.catch(() => {});
    return entry;
  }

  private trim() {
    const idle = [...this.entries.values()].filter(
      (entry) => entry.users === 0,
    );
    let idleBytes = idle.reduce((total, entry) => total + entry.bytes, 0);
    idle.sort((a, b) => a.lastUse - b.lastUse);
    for (const entry of idle) {
      if (
        this.maxIdleBytes > 0 &&
        entry.source &&
        idleBytes <= this.maxIdleBytes
      )
        continue;
      idleBytes -= entry.bytes;
      this.entries.delete(entry.url);
      entry.controller.abort();
      if (entry.source) {
        this.sources.delete(entry.source);
        disposeBitmapSource(entry.source);
        entry.source = null;
      }
      entry.ready = null;
    }
  }
}
