import { describe, expect, it } from "vitest";
import {
  getLocalInitJsPsychPreview,
  getLocalOnDataUpdatePreview,
  getLocalOnFinishPreview,
  getPreInitLocalPreview,
  getPreInitPublicPreview,
  getPublicInitJsPsychPreview,
  getPublicOnDataUpdatePreview,
  getPublicOnFinishPreview,
  getPublicOnTrialStartPreview,
} from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/getInitJsPsychPreview";

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

describe("getInitJsPsychPreview helpers", () => {
  it("injects pre-init user code into local and public preview shells", () => {
    const local = getPreInitLocalPreview("exp-1", "window.localReady = true;");
    const publicPreview = getPreInitPublicPreview(
      "exp-1",
      "window.publicReady = true;",
    );

    expect(local).toContain("// --- Your code (runs here, before initJsPsych) ---");
    expect(local).toContain("window.localReady = true;");
    expect(local).toContain("const pendingDataSaves = [];");
    expect(publicPreview).toContain("const pendingBatchSaves = [];");
    expect(publicPreview).toContain("const _prolificPID");
    expect(publicPreview).toContain("window.publicReady = true;");
  });

  it("renders local initJsPsych preview with progress bar and persistence hooks", () => {
    const code = normalize(getLocalInitJsPsychPreview("exp-1", true));

    expect(code).toContain("const jsPsych = initJsPsych({");
    expect(code).toContain("show_progress_bar: true,");
    expect(code).toContain('/api/append-result/exp-1');
    expect(code).toContain("localStorage.setItem('jsPsych_resumeTrial'");
    expect(code).toContain("socket.emit('update-session-state'");
    expect(code).toContain("await fetch(\"/api/complete-session/exp-1\"");
  });

  it("renders public initJsPsych preview with batching and Firebase session updates", () => {
    const code = normalize(getPublicInitJsPsychPreview("exp-2", false));

    expect(code).toContain("// show_progress_bar: false,");
    expect(code).toContain("on_trial_start: function(trial)");
    expect(code).toContain("await TrialDB.add(data);");
    expect(code).toContain("sendBatchConcatenated");
    expect(code).toContain("sessionRef.onDisconnect().cancel();");
    expect(code).toContain("firebase.database.ServerValue.TIMESTAMP");
  });

  it("renders placeholder IDs, opposite progress states and empty user blocks", () => {
    const localPreInit = getPreInitLocalPreview("exp-empty");
    const publicPreInit = getPreInitPublicPreview("exp-empty", "   ");
    const local = normalize(getLocalInitJsPsychPreview(undefined, false));
    const publicPreview = normalize(
      getPublicInitJsPsychPreview(undefined, true),
    );
    const onTrialStart = getPublicOnTrialStartPreview();

    expect(localPreInit).toContain("// (your code will run here)");
    expect(publicPreInit).toContain("// (your code will run here)");
    expect(local).toContain("// show_progress_bar: false,");
    expect(local).toContain("/api/append-result/[experimentID]");
    expect(publicPreview).toContain("show_progress_bar: true,");
    expect(publicPreview).toContain("data.experimentID = '[experimentID]'");
    expect(onTrialStart).not.toContain("// --- User code ---");
  });

  it("injects user code into local lifecycle callback previews", () => {
    const onDataUpdate = getLocalOnDataUpdatePreview(
      "exp-3",
      "data.extra = true;",
    );
    const onFinish = getLocalOnFinishPreview("exp-3", "window.done = true;");

    expect(onDataUpdate).toContain("// --- User code ---");
    expect(onDataUpdate).toContain("data.extra = true;");
    expect(onDataUpdate).toContain("pendingDataSaves.push(savePromise);");
    expect(onFinish).toContain("window.done = true;");
    expect(onFinish).toContain("Promise.allSettled(pendingDataSaves)");
  });

  it("injects user code into public lifecycle callback previews", () => {
    const onTrialStart = getPublicOnTrialStartPreview("trial.flag = 1;");
    const onDataUpdate = getPublicOnDataUpdatePreview(
      "exp-4",
      "data.publicExtra = true;",
    );
    const onFinish = getPublicOnFinishPreview("exp-4", "window.finished = true;");

    expect(onTrialStart).toContain("trial.flag = 1;");
    expect(onDataUpdate).toContain("data.publicExtra = true;");
    expect(onDataUpdate).toContain("data.clientTimestamp = Date.now();");
    expect(onDataUpdate).toContain("await TrialDB.add(data);");
    expect(onFinish).toContain("window.finished = true;");
    expect(onFinish).toContain("await TrialDB.clear();");
  });
});
