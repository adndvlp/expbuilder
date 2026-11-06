import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { firestoreMocks, okJson } from "./testHarness";
import { useExperimentSettings } from "../../../pages/ExperimentPanel/ExperimentSettings/hooks/useExperimentSettings";

const saved = {
  schemaVersion: 1,
  revision: 4,
  batchConfig: { useIndexedDB: false, batchSize: 12, resumeTimeoutMinutes: 20 },
  recruitmentConfig: { platform: "mturk", prolificCompletionCode: "" },
  captchaConfig: { enabled: false, provider: "hcaptcha", siteKey: "" },
};
const reply = () => ({
  functionalSettings: saved,
  revision: 4,
  settingsMigration: { state: "complete", source: "local" },
});
beforeEach(() => {
  vi.clearAllMocks();
  firestoreMocks.getDoc.mockResolvedValue({ exists: () => false });
  globalThis.fetch = vi.fn(async (url) =>
    okJson(
      String(url).includes("/functional-settings/")
        ? reply()
        : { tokens: [], separator: "_" },
    ),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
});
test("loads and saves a local draft without reading or writing Firestore", async () => {
  const { result } = renderHook(() => useExperimentSettings("new-local"));
  await waitFor(() => expect(result.current.config.batchSize).toBe(12));
  act(() =>
    result.current.setConfig({ ...result.current.config, batchSize: 19 }),
  );
  vi.mocked(fetch).mockResolvedValueOnce(
    okJson({ ...reply(), functionalSettings: { ...saved, revision: 5 } }),
  );
  await act(async () => result.current.handleSave());
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/api/functional-settings/new-local"),
    expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining('"expectedRevision":4'),
    }),
  );
  expect(firestoreMocks.getDoc).not.toHaveBeenCalled();
  expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
});
test("unknown legacy settings expose review and are editable before publication", async () => {
  vi.mocked(fetch).mockImplementation(async (url) =>
    okJson(
      String(url).includes("/functional-settings/")
        ? {
            functionalSettings: null,
            revision: 0,
            settingsMigration: { state: "needs_remote_read", source: "local" },
          }
        : { tokens: [], separator: "_" },
    ),
  );
  const { result } = renderHook(() => useExperimentSettings("legacy"));
  await waitFor(() => expect(result.current.experimentExists).toBe(true));
  expect(result.current.settingsMigration?.state).toBe("needs_remote_read");
  expect(firestoreMocks.getDoc).not.toHaveBeenCalled();
});
test("a revision conflict keeps the unsaved edits and offers reload", async () => {
  const { result } = renderHook(() => useExperimentSettings("new-local"));
  await waitFor(() => expect(result.current.config.batchSize).toBe(12));
  act(() =>
    result.current.setConfig({ ...result.current.config, batchSize: 55 }),
  );
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({
      code: "SETTINGS_REVISION_CONFLICT",
      message: "Settings changed. Reload saved settings before saving again.",
    }),
  } as Response);
  await act(async () => result.current.handleSave());
  expect(result.current.config.batchSize).toBe(55);
  expect(result.current.hasConflict).toBe(true);
  expect(result.current.message?.text).toMatch(/saved version/i);
});
