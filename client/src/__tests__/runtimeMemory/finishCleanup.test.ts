import { describe, expect, it, vi } from "vitest";
import { buildLocalFinishCallback } from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/localRuntimeCallbacks";
import type { LocalExperimentCodeOptions } from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/localCodeTypes";

function finishCallback(
  pending: boolean,
  plugin: { dispose?: () => void } | undefined,
) {
  const code = buildLocalFinishCallback({
    experimentID: "memory",
    localParams: {},
  } as LocalExperimentCodeOptions);
  const makeCallback = new Function(
    "window",
    "DynamicPlugin",
    "_runtimeTrace",
    "_showLoading",
    `return ({ ${code} }).on_finish;`,
  );
  return makeCallback(
    { ExpBuilderNavigation: { isTransitionPending: () => pending } },
    plugin,
    vi.fn(),
    () => {
      throw new Error("Reached data saving");
    },
  ) as () => Promise<void>;
}

describe("Generated finish cleanup", () => {
  it("preserves visual resources when a finish callback represents a pending jump", async () => {
    const dispose = vi.fn();
    await finishCallback(true, { dispose })();
    expect(dispose).not.toHaveBeenCalled();
  });

  it("releases completed presentation resources before saving the final payload", async () => {
    const dispose = vi.fn();
    await expect(finishCallback(false, { dispose })()).rejects.toThrow(
      "Reached data saving",
    );
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, {}])(
    "remains usable with a runtime without the cleanup API (%s)",
    async (plugin) => {
      await expect(finishCallback(false, plugin)()).rejects.toThrow(
        "Reached data saving",
      );
    },
  );
});
