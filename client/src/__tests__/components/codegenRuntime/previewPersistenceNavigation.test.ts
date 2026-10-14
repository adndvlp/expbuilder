import { expect, it, vi } from "vitest";
import { buildSelectedPreviewPersistence } from "../../../pages/ExperimentBuilder/components/experiment-preview/selectedPreviewPersistence";

it("acknowledges volatile preview results so a native jump can resume without a saved session", () => {
  const window = { ExpBuilderNavigation: { onTrialPersisted: vi.fn() } };
  const code = buildSelectedPreviewPersistence({ experimentID: "preview", isSaveMode: false, selectionName: "trial" });
  const persist = new Function("window", `${code}; return persistPreviewResult;`)(window);
  const data = { builder_id: 1, trial_index: 0 };
  persist(data);
  expect(window.ExpBuilderNavigation.onTrialPersisted).toHaveBeenCalledExactlyOnceWith(data);
});
