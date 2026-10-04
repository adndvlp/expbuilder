type Job = {
  key: string;
  priority: number;
  start(): void;
  cancel(): void;
};

export class AssetLoadQueue {
  private jobs: Job[] = [];
  private active = 0;

  constructor(private concurrency = 2) {
    if (!Number.isInteger(concurrency) || concurrency < 1)
      throw new Error("Asset concurrency must be a positive integer");
  }

  promote(key: string, priority = 0) {
    for (const job of this.jobs)
      if (job.key === key) job.priority = Math.min(job.priority, priority);
    this.drain();
  }

  run<T>(
    key: string,
    task: () => Promise<T>,
    signal?: AbortSignal,
    priority = 0,
  ) {
    return new Promise<T>((resolve, reject) => {
      const abort = () => {
        const index = this.jobs.indexOf(job);
        if (index < 0) return; // A running task owns its cancellation.
        this.jobs.splice(index, 1);
        job.cancel();
      };
      const job: Job = {
        key,
        priority,
        cancel: () => {
          signal?.removeEventListener("abort", abort);
          reject(new DOMException("Asset preparation cancelled", "AbortError"));
        },
        start: () => {
          signal?.removeEventListener("abort", abort);
          this.active++;
          let result: Promise<T>;
          try {
            result = task();
          } catch (error) {
            result = Promise.reject(error);
          }
          result.then(resolve, reject).finally(() => {
            this.active--;
            this.drain();
          });
        },
      };
      if (signal?.aborted) {
        job.cancel();
        return;
      }
      signal?.addEventListener("abort", abort, { once: true });
      this.jobs.push(job);
      this.drain();
    });
  }

  private drain() {
    this.jobs.sort((a, b) => a.priority - b.priority);
    while (this.active < this.concurrency && this.jobs.length)
      this.jobs.shift()!.start();
  }
}

// Shared by bitmap decoding, DOM images and jsPsych audio/video preparations.
export const assetLoadQueue = new AssetLoadQueue();
