import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicBootstrapCode } from "../publicBootstrapCode";
import { getPublicRuntimeStorageKeys } from "../publicRuntimeStorageKeys";
import type { PublicExperimentCodeOptions } from "../publicCodeTypes";
import { publicEventStorageCode } from "../publicEventStorageCode";

const keys = getPublicRuntimeStorageKeys("restore-test");
const checkpoint = (completed: string, target = completed) => ({ completed, cursor: { targetId: target } });
async function restore(indexed: boolean, serverCheckpoint: unknown, localCheckpoint: unknown = null, cached: unknown = null,
  localSequence = 1, serverSequence = 0) {
  if (cached) localStorage.setItem(keys.resumeTrial, JSON.stringify(cached));
  const settings = { batchConfig: { useIndexedDB: indexed, batchSize: 0, resumeTimeoutMinutes: 1 },
    recruitmentConfig: { platform: 'none', prolificCompletionCode: '' }, captchaConfig: { enabled: false, provider: 'hcaptcha', siteKey: '' } };
  const options = { experimentID: "restore-test", useStorage: "googledrive", evaluateCondition: "" } as PublicExperimentCodeOptions;
  const code = publicBootstrapCode(options);
  return new Function("serverCheckpoint", "localCheckpoint", "localSequence", "serverSequence", `
    ${publicEventStorageCode()}
    let participantNumber;
    const _publicStorageKeys = ${JSON.stringify(keys)}, trialSessionId = 'S1', isResuming = true;
    const metadata = {}, firebaseConfig = {};
    const TrialDB = { init: async () => {}, getAll: async () => [], clear: async () => {},
      syncManifest: async () => {}, getState: async () => ({ checkpoint: localCheckpoint, checkpointSequence: localSequence, nextSequence: 3, events: [] }) };
    const createSession = async () => ({ success: true, sessionId: 'S1', participantNumber: 23,
      configuration: ${JSON.stringify(settings)}, receivedEvents: [], resumeCheckpoint: serverCheckpoint, resumeCheckpointSequence: serverSequence });
    const _setLoadingMsg = () => {}, _hideLoading = () => {}, waitForFirebase = async () => {};
    const _sessionNameHasDynamic = () => false;
    const _resolveResumeBranch = value => JSON.parse(value);
    window.ExpBuilderNavigation = { activateResume: () => {} };
    const database = () => ({ ref: () => ({ set: async () => {}, onDisconnect: () => ({ update() {} }) }) });
    database.ServerValue = { TIMESTAMP: 1 };
    window.firebase = { apps: [{}], database };
    return ${code.trim()}
      return { participantNumber, decision: resumeRouteDecision };
    })();
  `)(serverCheckpoint, localCheckpoint, localSequence, serverSequence) as Promise<{ participantNumber: number; decision: unknown }>;
}
describe("restoring backed progress", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    vi.stubGlobal("sessionStorage", { getItem: () => null });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("H03: without IndexedDB uses the server checkpoint instead of an unacknowledged local cursor", async () => {
    const result = await restore(false, checkpoint("A"), null, checkpoint("B"));
    expect(result.participantNumber).toBe(23);
    expect(result.decision).toEqual(checkpoint("A"));
  });
  it("can restore a locally committed response that is still pending upload", async () => {
    const result = await restore(true, checkpoint("A"), checkpoint("B"), checkpoint("C"));
    expect(result.decision).toEqual(checkpoint("B"));
  });
  it("keeps a trial-start cursor only when it has the same backed completed response", async () => {
    const cached = checkpoint("A", "next-trial");
    expect((await restore(false, checkpoint("A"), null, cached)).decision).toEqual(cached);
  });
  it("prefers a newer server checkpoint even when syncing its receipts advanced the local counter", async () => {
    expect((await restore(true, checkpoint("B"), checkpoint("A"), null, 0, 1)).decision).toEqual(checkpoint("B"));
  });
  it("recognizes the same completed event when Firestore returns its fields in another order", async () => {
    const backed = { completed: { builderId: 'A', eventId: 'saved-0', sequence: 0, trialIndex: 0 }, cursor: { targetId: 'A' } };
    const cached = { completed: { trialIndex: 0, builderId: 'A', sequence: 0, eventId: 'saved-0' }, cursor: { targetId: 'next-trial' } };
    expect((await restore(false, backed, null, cached)).decision).toEqual(cached);
  });
  it("ignores a legacy cache with no backed response", async () => {
    expect((await restore(false, null, null, checkpoint("B"))).decision).toBeNull();
  });
});
