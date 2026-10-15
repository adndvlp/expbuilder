import type { MediaResource, ResourceInventory } from "./resourceInventory";

export type MediaMetadata = {
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  animated?: boolean;
};
export type MetadataState = {
  status: "loading" | "ready" | "error";
  metadata?: MediaMetadata;
};
export const IPHONE_REFERENCE_BYTES = 1_500_000_000;
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function estimateResource(
  resource: MediaResource,
  state?: MetadataState,
) {
  const metadata = state?.metadata;
  let bytes = 0;
  const missing: string[] = [];
  if (!metadata)
    missing.push(
      state?.status === "error" ? "Metadata unavailable" : "Reading metadata",
    );
  else if (resource.kind === "image") {
    if (positive(metadata.width) && positive(metadata.height))
      bytes = metadata.width * metadata.height * 4;
    else missing.push("Image dimensions unknown");
    if (metadata.animated) missing.push("Additional animation frames unknown");
  } else if (resource.kind === "audio") {
    if (
      positive(metadata.durationSeconds) &&
      positive(metadata.sampleRate) &&
      positive(metadata.channels)
    )
      bytes =
        Math.ceil(metadata.durationSeconds * metadata.sampleRate) *
        metadata.channels *
        4;
    else missing.push("Decoded audio size unknown");
  } else {
    if (positive(metadata.sizeBytes)) bytes += metadata.sizeBytes;
    else missing.push("Video file size unknown");
    if (positive(metadata.width) && positive(metadata.height))
      bytes += metadata.width * metadata.height * 4 * resource.instances;
    else missing.push("Video dimensions unknown");
  }
  return {
    ...resource,
    bytes,
    fileBytes: metadata?.sizeBytes,
    metadata,
    missing,
  };
}

export function estimateTrialResources(
  inventory: ResourceInventory,
  states: Record<string, MetadataState>,
) {
  const rows = inventory.resources.map((resource) =>
    estimateResource(resource, states[resource.key]),
  );
  const bytes = rows.reduce(
    (total, row) => total + row.bytes,
    inventory.canvasBytes,
  );
  return {
    rows,
    bytes,
    fileBytes: rows.reduce((total, row) => total + (row.fileBytes || 0), 0),
    missing:
      inventory.unresolved.length +
      rows.filter((row) => row.missing.length > 0).length,
    pending: rows.filter(
      (row) => !states[row.key] || states[row.key].status === "loading",
    ).length,
    level:
      bytes >= IPHONE_REFERENCE_BYTES
        ? "high"
        : bytes >= IPHONE_REFERENCE_BYTES * 0.8
          ? "near"
          : "unverified",
  };
}

export function formatMemory(bytes: number) {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(1)} KB`;
}
