import type { Page } from "@playwright/test";
import { publicBatchCode } from "../publicBatchCode";
import { publicDatabaseCode } from "../publicDatabaseCode";
import { publicInitCode } from "../publicInitCode";
import { publicFinishCode } from "../publicFinishCode";
import { getPersistenceCoordinatorRuntimeCode } from "../../../../../modules/experiment-runtime/persistenceCoordinator";
import type { PublicExperimentCodeOptions } from "../publicCodeTypes";

export type Row = Record<string, unknown>;
export type Event = { eventId: string; sequence: number; payloadHash: string; payload: Row };
export type Upload = { experimentID: string; sessionId: string; action?: string; data: { events?: Event[]; trialsData?: string };
  expectedEventCount?: number; expectedLastSequence?: number; eventsHash?: string };
type Runtime = {
  db: { getAll(): Promise<Row[]>; count(): Promise<number>; getState(): Promise<{ events: Row[]; checkpoint?: Row }>; close?: () => void };
  pending: Promise<unknown>[]; errors: string[]; acknowledged: unknown[];
  call(data: Row): void; finish(): Promise<void>; success: boolean;
  pauses: number; resumes: number; updates: Row[]; messages: string[];
  checkpoint?: (data: Row) => Row;
};
declare global { interface Window { publicBatchTest: Runtime } }

export async function startPublicRuntime(page: Page, size = 1, indexed = true) {
  const options = {
    DATA_API_URL: "/apiData", FIREBASE_DATABASE_URL: "https://example.invalid",
    experimentID: "batch-test", useStorage: "googledrive",
    batchConfig: { useIndexedDB: indexed, batchSize: size, resumeTimeoutMinutes: 1 },
    recruitmentConfig: { platform: "none", prolificCompletionCode: "" },
    captchaConfig: { enabled: false, provider: "hcaptcha", siteKey: "" },
    sessionNameTokens: [], sessionNameSeparator: "_", currentUid: "owner",
    evaluateCondition: "", branchingEvaluation: "", customPreInitCode: { local: "", public: "" },
    publicParams: {}, extensions: "", progressBar: false, baseCode: "",
  } as PublicExperimentCodeOptions;
  const callbackCode = (publicInitCode(options) + publicFinishCode(options)).split("// __INIT_JSPSYCH_END__")[0];
  await page.evaluate(({ databaseCode, batchCode, callbackCode, persistenceCode, size, indexed }) => {
    const runtime = { pending: [], errors: [], acknowledged: [], success: false,
      pauses: 0, resumes: 0, updates: [], messages: [] } as unknown as Runtime;
    window.publicBatchTest = runtime;
    let callbacks: { on_data_update(row: Row): Promise<void>; on_finish(): Promise<void> };
    runtime.db = new Function("initJsPsych", `
      const trialSessionId = 'S1';
      const BATCH_CONFIG = { useIndexedDB: ${indexed}, size: ${size}, currentBatchNumber: 0 };
      const metadata = {}, _publicSessionState = { receivedEvents: [] }, _publicStorageKeys = { resumeTrial: 'checkpoint', sessionId: 'session', participant: 'participant' };
      const _createResumeCheckpoint = data => window.publicBatchTest.checkpoint?.(data) ?? ({ completed: data.builder_id });
      const sessionRef = { update: async value => window.publicBatchTest.updates.push(value), onDisconnect: () => ({ cancel() {} }) };
      window.firebase = { database: { ServerValue: { TIMESTAMP: 1 } } };
      window.ExpBuilderNavigation = {
        onTrialPersisted: data => window.publicBatchTest.acknowledged.push(data.builder_id),
        checkpointTrialStart() {}, isTransitionPending: () => false, clearTransientState() {}
      };
      window.ExpBuilderRuntime = { reportError: error => window.publicBatchTest.errors.push(String(error)) };
      function _showLoading() {} function _setLoadingMsg(value) { window.publicBatchTest.messages.push(value); }
      function _showSuccess() { window.publicBatchTest.success = true; }
      ${persistenceCode}
      ${databaseCode}
      ${batchCode}
      ${callbackCode}
      return TrialDB;
    `)((value: typeof callbacks) => { callbacks = value; return { data: { get: () => ({}) },
      pauseExperiment: () => runtime.pauses++, resumeExperiment: () => runtime.resumes++ }; });
    runtime.call = data => {
      runtime.pending.push(callbacks.on_data_update(data).catch(error => runtime.errors.push(String(error))));
    };
    runtime.finish = () => callbacks.on_finish();
  }, { databaseCode: publicDatabaseCode(options), batchCode: publicBatchCode(options), callbackCode,
    persistenceCode: getPersistenceCoordinatorRuntimeCode(), size, indexed });
}

export function receipt(body: Upload) {
  const completion = body.action === 'completeSession' ? { confirmed: true, expectedEventCount: body.expectedEventCount,
    expectedLastSequence: body.expectedLastSequence, eventsHash: body.eventsHash } : undefined;
  return { success: true, experimentID: body.experimentID, sessionId: body.sessionId,
    completion, acknowledged: (body.data?.events ?? []).map(({ eventId, sequence, payloadHash }) => ({ eventId, sequence, payloadHash })) };
}

export function responses(body: Upload) {
  return body.data?.events?.map(event => event.payload.builder_id)
    ?? JSON.parse(body.data?.trialsData ?? "[]").map((row: Row) => row.builder_id);
}

export const trial = (builder_id: string, trial_index = 0) => ({ builder_id, trial_index, trial_type: "test", response: builder_id });
