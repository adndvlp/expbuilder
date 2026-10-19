import { expect, test } from "@playwright/test";
import path from "node:path";
import { resumeCode } from "../../src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/ResumeCode";
import { publicInitCode } from "../../src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicInitCode";
import { branchingEvaluationRuntimeCode } from "../../src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/branchingRuntimeCode";
import { generateOnFinishCode } from "../../src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/onFinishGenerator";
import { runtimeApiBaseUrl } from "../support/session";
import type { PublicExperimentCodeOptions } from "../../src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicCodeTypes";
import type { JsPsych, TimelineArray, initJsPsych } from "jspsych";

type Row = Record<string, unknown>;
type BrowserRuntime = {
  initJsPsych: typeof initJsPsych;
  firebase: unknown;
  ExpBuilderExecutionAddresses: Row;
  ExpBuilderBranching: { decide(data: Row, branches: (string | number)[], conditions: unknown[]): unknown };
  ExpBuilderNavigation: { registerTrial(id: number, node: Row): void; attach(instance: JsPsych, timeline: TimelineArray): void };
};

for (const indexedDB of [true, false]) {
 for (const target of [4, 5]) {
  test(`public branching to ${target} decides each source once with slow ${indexedDB ? "IndexedDB" : "network"} persistence`, async ({ page }) => {
    await page.route("**/native-public-fixture", route => route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }));
    await page.goto(`${runtimeApiBaseUrl}/native-public-fixture`);
    await page.addScriptTag({ path: path.resolve("../server/jspsych-bundle/index.js") });
    let navigations = 0;
    page.on("framenavigated", () => navigations++);
    const init = publicInitCode({
      experimentID: "public-fixture", DATA_API_URL: "/save",
      customPreInitCode: {}, publicParams: {}, extensions: "",
      branchingEvaluation: branchingEvaluationRuntimeCode,
    } as PublicExperimentCodeOptions);
    const callback = init.slice(init.indexOf("on_data_update: ") + "on_data_update: ".length).trim().replace(/,\s*$/, "");
    const hooks = [1, 2, 3, 4, 5, 6].map(id => generateOnFinishCode({
      branches: id === 3 ? [4, 5] : id === 1 ? [2] : id === 2 ? [3] : id === target ? [6] : [],
      defaultNextTrialId: id === 1 ? 2 : id === 2 ? 3 : id === target ? 6 : null,
      branchConditions: id === 3 ? [{ id: 160, nextTrialId: target, rules: [{ column: "response", op: "==", value: "0" }] }] : [],
      getVarName: name => name,
      isMergePoint: id === 4,
    }));
    const result = await page.evaluate(async ({ runtimeCode, callback, hooks, indexedDB, target }) => {
      const events: number[] = [];
      const saved: number[] = [];
      const pending: Promise<unknown>[] = [];
      let decisions = 0;
      const storage = localStorage;
      const initialize = new Function("window", "localStorage", "sessionStorage", `${runtimeCode}; return _createResumeCheckpoint;`);
      const checkpoint = initialize(window, storage, sessionStorage);
      const runtime = window as unknown as BrowserRuntime;
      const evaluator = runtime.ExpBuilderBranching;
      runtime.ExpBuilderBranching = { ...evaluator, decide(...args: Parameters<typeof evaluator.decide>) { decisions++; return evaluator.decide(...args); } };
      runtime.firebase = { database: { ServerValue: { TIMESTAMP: 0 } } };
      const delay = () => new Promise(resolve => setTimeout(resolve, 25));
      const save = async (data: Row) => { await delay(); saved.push(Number(data.builder_id)); };
      const callbackFactory = new Function("BATCH_CONFIG", "TrialDB", "trialSessionId", "sessionRef", "jsPsych", "_publicStorageKeys", "_createResumeCheckpoint", "fetch", `return (${callback});`);
      const proxy = { data: { getLastTrialData: () => jsPsych.data.getLastTrialData() } };
      const onData = callbackFactory(
        { useIndexedDB: indexedDB, size: 0 }, { add: save }, "public-session",
        { update: () => Promise.resolve() }, proxy, { resumeTrial: "public-checkpoint" }, checkpoint,
        async (_url: string, request: { body: string }) => { await save(JSON.parse(request.body).data); return { ok: true }; },
      );
      const jsPsych = runtime.initJsPsych({ use_webaudio: false, on_data_update(data: Row) { pending.push(onData(data)); } });
      class AutoTrial {
        static info = { name: "native-public-auto", version: "1.0", parameters: {}, data: {} };
        constructor(private instance: JsPsych) {}
        trial() { this.instance.finishTrial({ response: 0 }); }
      }
      class SlowTrial extends AutoTrial {
        trial() { setTimeout(() => super.trial(), 80); }
      }
      runtime.ExpBuilderExecutionAddresses = {
        version: 3, entries: { root: "1" }, loopContinuations: {}, revision: "public-r1", nextBySource: {},
        scopes: { root: target === 4 ? ["1", "2", "3", "4", "5", "6"] : ["6", "5", "4", "3", "2", "1"] }, allScopes: { root: ["1", "2", "3", "4", "5", "6"] },
        addressesByTarget: Object.fromEntries([1, 2, 3, 4, 5, 6].map(id => [id, { targetId: id, targetKind: "trial", targetOwnerId: null, enterLoopIds: [] }])),
      };
      const navigation = runtime.ExpBuilderNavigation;
      for (const [index, hook] of hooks.entries()) {
        const id = index + 1;
        const onFinish = new Function("jsPsych", "trialSessionId", `return ({${hook}}).on_finish;`)(jsPsych, "public-session");
        navigation.registerTrial(id, {
          type: id === target ? SlowTrial : AutoTrial,
          data: { builder_id: id, trial_id: id },
          on_finish(data: Row) { events.push(id); onFinish(data); },
        });
      }
      const timeline: TimelineArray = [];
      navigation.attach(jsPsych, timeline);
      await jsPsych.run(timeline);
      await Promise.all(pending);
      return { events, saved, decisions, rows: jsPsych.data.get().values().length };
    }, { runtimeCode: resumeCode(), callback, hooks, indexedDB, target });
    const expected = [1, 2, 3, target, 6];
    expect(result.events).toEqual(expected);
    expect(result.saved).toEqual(expected);
    expect(result.decisions).toBe(expected.length);
    expect(result.rows).toBe(expected.length);
    expect(navigations).toBe(0);
  });
 }
}
