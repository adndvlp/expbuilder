// These fixtures exercise the legacy provider contract; workspace persistence is
// exercised separately by workspaceClient and the real HTTP/browser harness.
import { vi } from "vitest";
vi.mock(
  "../../pages/ExperimentBuilder/modules/experiment-graph/api",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("../../pages/ExperimentBuilder/modules/experiment-graph/api")
      >();
    return {
      ...original,
      loadExperimentGraph: (id: string, options = {}) =>
        original.loadLegacyExperimentGraph(id, {
          ...options,
          fetchImpl: (...args) => globalThis.fetch(...args),
        }),
    };
  },
);
