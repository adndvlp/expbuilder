import { assetError } from "./paths.js";
const active = new Map();
export function beginAssetWrite(relative) {
  active.set(relative, (active.get(relative) || 0) + 1);
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    const count = (active.get(relative) || 1) - 1;
    if (count) active.set(relative, count);
    else active.delete(relative);
  };
}
export function assertAssetIdle(relative) {
  if (active.has(relative))
    throw assetError(
      "ASSETS_BUSY",
      409,
      "Wait for media processing to finish before replacing, deleting or exporting this experiment.",
    );
}
