import { describe, expect, it } from "vitest";
import type { LocalExperimentCodeOptions } from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/localCodeTypes";
import { buildLocalOutboxCode } from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/localOutboxCode";
import { buildLocalRuntimeStart } from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/localRuntimeStart";

const options: LocalExperimentCodeOptions = {
  experimentID: "experiment-a",
  sessionNameTokens: [],
  sessionNameSeparator: "_",
  evaluateCondition: "",
  branchingEvaluation: "",
  baseCode: "jsPsych.run([]);",
  customCode: undefined,
  customPreInitCode: { local: "" },
  extensions: "",
  localParams: {},
  progressBar: false,
};

describe("local outbox navigation barrier", () => {
  it("continues an intentional jump with the persisted session identity", () => {
    const code = buildLocalRuntimeStart(options);
    const continuityGuard = code.indexOf(
      "The jump cannot continue without its original session",
    );
    const newSessionFallback = code.indexOf("trialSessionId = _newId()");

    expect(continuityGuard).toBeGreaterThan(-1);
    expect(newSessionFallback).toBeGreaterThan(continuityGuard);
    expect(code).toContain(
      'localStorage.removeItem("expbuilder:local:experiment-a:resume-trial")',
    );
    expect(code).toContain("sessionId: String(trialSessionId)");
    expect(code).not.toContain("newSessionId");
  });

  it("notifies navigation only after the strict acknowledgement is durable", () => {
    const code = buildLocalOutboxCode();
    const acknowledgementValidation = code.indexOf(
      "body.storedCount < record.sequence + 1",
    );
    const durableRecord = code.indexOf(
      "await saveRecord(record)",
      acknowledgementValidation,
    );
    const navigationNotification = code.indexOf(
      "notifyAcknowledged(record)",
      durableRecord,
    );

    expect(acknowledgementValidation).toBeGreaterThan(-1);
    expect(durableRecord).toBeGreaterThan(acknowledgementValidation);
    expect(navigationNotification).toBeGreaterThan(durableRecord);
    expect(code).toContain(
      "window.ExpBuilderPersistence?.track?.(flushPromise)",
    );
  });

  it("subscribes before flushing records recovered from IndexedDB", () => {
    const code = buildLocalRuntimeStart(options);
    const subscription = code.indexOf("localOutbox.onAcknowledged");
    const initialization = code.indexOf("await localOutbox.initialize");
    const recoveredFlush = code.indexOf("void localOutbox.flush()");

    expect(subscription).toBeGreaterThan(-1);
    expect(initialization).toBeGreaterThan(subscription);
    expect(recoveredFlush).toBeGreaterThan(initialization);
    expect(code).toContain(
      "window.ExpBuilderNavigation.onTrialPersisted(data)",
    );
  });
});
