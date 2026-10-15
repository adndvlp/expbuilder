import { describe, expect, it, vi } from "vitest";
import {
  resumeStartupCode,
  activateResumeRouteDecisionCode,
} from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/resumeStartupCode";

function startup(isResuming: boolean, raw: string | null, resolved: unknown) {
  const activateResume = vi.fn();
  const resolve = vi.fn(() => resolved);
  const window = {
    ExpBuilderNavigation: { activateResume },
    ExpBuilderRuntime: { emit: vi.fn() },
  };
  const run = () =>
    new Function(
      "window",
      "localStorage",
      "isResuming",
      "_resolveResumeBranch",
      resumeStartupCode("scoped:resume") + activateResumeRouteDecisionCode(),
    )(
      window,
      { getItem: (key: string) => (key === "scoped:resume" ? raw : null) },
      isResuming,
      resolve,
    );
  return { run, activateResume, resolve };
}
describe("resume startup", () => {
  it("activates the saved cursor only for an existing session", () => {
    const decision = { kind: "cursor", targetId: "2" };
    const runtime = startup(true, "checkpoint", decision);
    runtime.run();
    expect(runtime.resolve).toHaveBeenCalledOnce();
    expect(runtime.activateResume).toHaveBeenCalledWith(decision);
  });
  it("does not consume a checkpoint for a new session", () => {
    const runtime = startup(false, "checkpoint", {});
    runtime.run();
    expect(runtime.resolve).not.toHaveBeenCalled();
    expect(runtime.activateResume).not.toHaveBeenCalled();
  });
  it("rejects a damaged checkpoint instead of silently restarting", () => {
    expect(startup(true, "damaged", null).run).toThrow("invalid");
  });
});
