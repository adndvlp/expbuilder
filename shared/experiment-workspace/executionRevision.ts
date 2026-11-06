import type { WorkspaceDocument } from "./types.js";
import type { Trial, Loop } from "./records.js";
import { isRegenerableTrialCode } from "./codeCache.js";
import { projectExecutable } from "./projection.js";
import { stableStringify } from "./serialization.js";
export async function executionRevision(
  document: WorkspaceDocument,
  resources: unknown = [],
  contract = "native-navigation/3",
) {
  const projected = projectExecutable(document);
  const strip = (record: Trial | Loop) =>
    Object.fromEntries(
      Object.entries(record).filter(
        ([key]) =>
          !(
            key === "trialCode" &&
            "trialCode" in record &&
            isRegenerableTrialCode(record)
          ) &&
          key !== "code" &&
          ![
            "updatedAt",
            "createdAt",
            "destinationOrder",
            "defaultPolicy",
            "expanded",
            "position",
            "trialCodeSource",
          ].includes(key),
      ),
    );
  const content = {
    contract,
    entryItemId: projected.entryItemId,
    timeline: projected.timeline,
    trials: projected.trials.map(strip),
    loops: projected.loops.map(strip),
    resources,
  };
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stableStringify(content)),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
