import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrialComponent } from "../types";
import type { UploadedFile } from "../../../../../utils/mapFileToUrl";
import { getApiBaseUrl } from "../../../../../../../lib/apiBaseUrl";
import { useExperimentID } from "../../../../../hooks/useExperimentID";
import { collectTrialResources, type MediaResource } from "./resourceInventory";
import { estimateTrialResources, type MetadataState } from "./resourceEstimate";
import { readMediaMetadata } from "./readMediaMetadata";

export function useTrialMemory(
  components: TrialComponent[],
  uploadedFiles: UploadedFile[],
) {
  const experimentID = useExperimentID();
  const apiUrl = getApiBaseUrl();
  const inventory = useMemo(
    () =>
      collectTrialResources(components, {
        experimentID,
        apiUrl,
        uploadedFiles,
      }),
    [components, experimentID, apiUrl, uploadedFiles],
  );
  const signature = JSON.stringify(
    inventory.resources.map(({ key, url, kind }) => ({
      key,
      url,
      kind,
      instances: 1,
    })),
  );
  const [states, setStates] = useState<Record<string, MetadataState>>({});
  const cache = useRef<Record<string, MetadataState>>({});
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => {
    cache.current = {};
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    const resources = JSON.parse(signature) as MediaResource[];
    const controller = new AbortController();
    const retained = Object.fromEntries(
      resources
        .filter((resource) => cache.current[resource.key])
        .map((resource) => [resource.key, cache.current[resource.key]]),
    );
    cache.current = retained;
    const pending = resources.filter((resource) => !retained[resource.key]);
    let next = 0;
    setStates(retained);
    const worker = async () => {
      while (!controller.signal.aborted && next < pending.length) {
        const resource = pending[next++];
        const requestController = new AbortController();
        const abort = () => requestController.abort();
        controller.signal.addEventListener("abort", abort, { once: true });
        const timeout = setTimeout(abort, 10000);
        let state: MetadataState;
        try {
          const metadata = await readMediaMetadata(
            resource,
            experimentID,
            apiUrl,
            requestController.signal,
          );
          state = { status: "ready", metadata };
        } catch {
          state = { status: "error" };
        } finally {
          clearTimeout(timeout);
          controller.signal.removeEventListener("abort", abort);
        }
        if (!controller.signal.aborted) {
          cache.current[resource.key] = state;
          setStates((previous) => ({ ...previous, [resource.key]: state }));
        }
      }
    };
    void worker();
    void worker();
    return () => controller.abort();
  }, [signature, experimentID, apiUrl, revision]);
  return { inventory, refresh, ...estimateTrialResources(inventory, states) };
}
