export const ALLOWED_MEDIA_TYPES = new Set(["img", "aud", "vid", "others"]);
export function sanitizeName(name) {
  return (
    String(name)
      .replace(/\.\./g, "_")
      .replace(/[^a-zA-Z0-9\-_. ]/g, "_")
      .trim() || "experiment"
  );
}
export { buildPackage as buildExperimentsZip } from "../../modules/experiment-packages/serialize.js";
