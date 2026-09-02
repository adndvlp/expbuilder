import { describe, expect, it } from "vitest";
import { buildLocalExperimentCode } from "../buildLocalExperimentCode";
import type { LocalExperimentCodeOptions } from "../localCodeTypes";

function options(experimentID: string): LocalExperimentCodeOptions {
  return {
    experimentID,
    sessionNameTokens: [],
    sessionNameSeparator: "_",
    evaluateCondition: "",
    branchingEvaluation: "",
    baseCode:
      "Object.entries(window.branchCustomParameters); jsPsych.run([]);",
    customCode: undefined,
    customPreInitCode: { local: "" },
    extensions: "",
    localParams: {},
    progressBar: false,
  };
}

describe("local session persistence code", () => {
  it("namespaces identity and never consumes the old global identity keys", () => {
    const code = buildLocalExperimentCode(options("experiment-a"));

    expect(code).toContain("'expbuilder:local:' + \"experiment-a\" + ':'")
    expect(code).toContain("sessionStorage.getItem(_tabKeys.sessionId)")
    expect(code).not.toContain("localStorage.getItem('jsPsych_currentSessionId')")
    expect(code).not.toContain("localStorage.getItem('jsPsych_participantNumber')")
    expect(code).not.toContain("localStorage.getItem('jsPsych_resumeTrial')")
  });

  it("blocks startup when an existing session cannot be verified", () => {
    const code = buildLocalExperimentCode(options("experiment-a"));

    expect(code).toContain(
      "throw new Error('The existing session could not be verified')",
    );
    expect(code).not.toContain("participantNumber = await saveSession(candidate)");
  });

  it("rejects an inconsistent persisted sequence before resuming", () => {
    const code = buildLocalExperimentCode(options("experiment-a"));

    expect(code).toContain("persisted.session.sequenceTracked !== true");
    expect(code).toContain("persisted.session.lastSequence !== persistedEventCount - 1");
    expect(code).toContain("The existing session has inconsistent saved results");
  });

  it("does not resume a completed session or accept an invalid participant", () => {
    const code = buildLocalExperimentCode(options("experiment-a"));

    expect(code).toContain("persisted.session.state !== 'completed'");
    expect(code).toContain("!Number.isInteger(participantNumber)");
    expect(code).toContain("participantNumber < 1");
  });

  it("requires strict creation and presence acknowledgements", () => {
    const code = buildLocalExperimentCode(options("experiment-a"));

    expect(code).toContain("body.id !== sessionId");
    expect(code).toContain("body.success !== true");
    expect(code).toContain("result && result.success === true");
    expect(code).toContain("script.onerror = function() { finish(false); }");
    expect(code.indexOf("_storePendingSessionIdentity(trialSessionId)")).toBeLessThan(
      code.indexOf("participantNumber = await saveSession(trialSessionId)"),
    );
  });

  it("persists before sending and requires a matching server acknowledgement", () => {
    const code = buildLocalExperimentCode(options("experiment-a"));

    expect(code.indexOf("await queued")).toBeLessThan(
      code.indexOf("return flush();", code.indexOf("async function enqueue")),
    );
    expect(code).toContain("body.eventId !== record.eventId")
    expect(code).toContain("body.sequence !== record.sequence")
    expect(code).toContain("body.storedCount < record.sequence + 1")
    expect(code).toContain("body.success !== true")
    expect(code).toContain("record.status = 'acknowledged'")
    expect(code).toContain("const eventId = sessionId + ':' + sequence")
    expect(code).toContain("const MAX_ATTEMPTS = 3")
    expect(code).toContain("flushPromise = flushAll().catch(function(error)")
    expect(code).toContain("if (error.retryable !== false) scheduleRetry()")
    expect(code).toContain("void waitForIdle().catch(function(error)")
    expect(code).toContain("for (const unsaved of unsavedRecords.values())")
  });

  it("blocks completion until every record is acknowledged", () => {
    const code = buildLocalExperimentCode(options("experiment-a"));

    expect(code).toContain("const stats = await localOutbox.waitForIdle()")
    expect(code).toContain("stats.pending !== 0")
    expect(code).toContain("expectedEventCount: stats.total")
    expect(code).toContain("body.storedEventCount !== stats.total")
    expect(code.indexOf("await localOutbox.clear()")).toBeGreaterThan(
      code.indexOf("body.storedEventCount !== stats.total"),
    );
    expect(code.lastIndexOf("_clearSessionIdentity()")).toBeGreaterThan(
      code.indexOf("await localOutbox.clear()"),
    );
  });

  it("does not report a durable completion as failed when user finish code throws", () => {
    const configured = options("experiment-a");
    configured.localParams = {
      on_finish: "throw new Error('custom finish failed')",
    };
    const code = buildLocalExperimentCode(configured);

    expect(code).toContain("[experiment] on_finish failed");
    expect(code).toContain("throw new Error('custom finish failed')");
  });

  it("generates isolated code for different experiments", () => {
    const first = buildLocalExperimentCode(options("experiment-a"));
    const second = buildLocalExperimentCode(options("experiment-b"));

    expect(first).toContain('"experiment-a"')
    expect(first).not.toContain('"experiment-b"')
    expect(second).toContain('"experiment-b"')
    expect(second).not.toContain('"experiment-a"')
  });

  it("elects one owner when tabs race to resume the same session", () => {
    const code = buildLocalExperimentCode(options("experiment-a"));

    expect(code).toContain("type: 'claim-probe'");
    expect(code).toContain("type: 'claim-response'");
    expect(code).toContain("const winner = Array.from(contenders).sort()[0]");
    expect(code).toContain("winner !== _tabId");
  });

  it("produces syntactically valid executable JavaScript", () => {
    const code = buildLocalExperimentCode(options("experiment-a"));
    expect(() => new Function(code)).not.toThrow();
  });
});
