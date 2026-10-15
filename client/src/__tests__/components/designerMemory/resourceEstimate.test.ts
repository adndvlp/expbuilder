import { expect, it } from "vitest";
import {
  estimateTrialResources,
  IPHONE_REFERENCE_BYTES,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/memory/resourceEstimate";
import type { ResourceInventory } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/memory/resourceInventory";

const inventory: ResourceInventory = {
  resources: [
    { key: "image", url: "img/photo.png", kind: "image", instances: 5 },
    { key: "audio", url: "aud/tone.wav", kind: "audio", instances: 2 },
    { key: "video", url: "vid/movie.mp4", kind: "video", instances: 2 },
  ],
  unresolved: [],
  canvasBytes: 640 * 480 * 4,
  componentCount: 9,
};

it("uses intrinsic pixels, decoded PCM and unique video Blobs plus per-player frames", () => {
  const result = estimateTrialResources(inventory, {
    image: {
      status: "ready",
      metadata: { sizeBytes: 1000, width: 4000, height: 3000 },
    },
    audio: {
      status: "ready",
      metadata: {
        sizeBytes: 2000,
        durationSeconds: 10,
        sampleRate: 48000,
        channels: 2,
      },
    },
    video: {
      status: "ready",
      metadata: { sizeBytes: 12_000_000, width: 1920, height: 1080 },
    },
  });
  expect(result.rows.map((row) => row.bytes)).toEqual([
    4000 * 3000 * 4,
    10 * 48000 * 2 * 4,
    12_000_000 + 1920 * 1080 * 4 * 2,
  ]);
  expect(result.fileBytes).toBe(12_003_000);
  expect(result.bytes).toBe(
    result.rows.reduce((sum, row) => sum + row.bytes, inventory.canvasBytes),
  );
  expect(result.missing).toBe(0);
  expect(result.level).toBe("unverified");
});

it("keeps missing metadata and CSV explicit instead of treating unknown resources as zero RAM", () => {
  const result = estimateTrialResources(
    { ...inventory, unresolved: ["CSV column"] },
    {
      image: { status: "error" },
      audio: {
        status: "ready",
        metadata: { sizeBytes: 2000, durationSeconds: 10 },
      },
    },
  );
  expect(result.missing).toBe(4);
  expect(result.pending).toBe(1);
  expect(result.rows[0].missing).toContain("Metadata unavailable");
  expect(result.rows[1].missing).toContain("Decoded audio size unknown");
});

it.each([
  [0.79, "unverified"],
  [0.8, "near"],
  [1, "high"],
])(
  "uses an advisory reference at %s without calling low readings safe",
  (ratio, level) => {
    const result = estimateTrialResources(
      {
        resources: [],
        unresolved: [],
        canvasBytes: IPHONE_REFERENCE_BYTES * Number(ratio),
        componentCount: 0,
      },
      {},
    );
    expect(result.level).toBe(level);
  },
);

it("marks animated-image frames as unmeasured", () => {
  const result = estimateTrialResources(
    { ...inventory, resources: inventory.resources.slice(0, 1) },
    {
      image: {
        status: "ready",
        metadata: { width: 100, height: 100, animated: true },
      },
    },
  );
  expect(result.bytes).toBe(100 * 100 * 4 + inventory.canvasBytes);
  expect(result.missing).toBe(1);
});
