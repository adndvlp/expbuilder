import { beforeEach, afterEach, test, expect, vi } from "vitest";
import PublishExperiment from "../../../pages/ExperimentBuilder/components/Timeline/PublishExperiment";
import { defaultFunctionalSettings } from "../../../lib/functionalSettings";
vi.mock("../../../lib/firebase", () => ({
  auth: { currentUser: { uid: "owner", getIdToken: async () => "id-token" } },
}));
const snapshot = defaultFunctionalSettings(7);
function harness() {
  const props = {
    experimentID: "local",
    setLastPagesUrl: vi.fn(),
    setPublishStatus: vi.fn(),
    getUserTokens: vi.fn(),
    setAvailableStorages: vi.fn(),
    setShowStorageModal: vi.fn(),
    setIsPublishing: vi.fn(),
    generateExperiment: vi.fn(async () => "code"),
  };
  return { props, api: PublishExperiment(props) };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
test("pending settings block generation and publication before contacting the cloud", async () => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      functionalSettings: null,
      revision: 0,
      settingsMigration: { state: "needs_review", source: "local" },
    }),
  })) as unknown as typeof fetch;
  const { props, api } = harness();
  await api.publishWithStorage("owner", "googledrive");
  expect(props.generateExperiment).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(props.setPublishStatus).toHaveBeenCalledWith(
    expect.stringContaining("Review and save"),
  );
});
test("the exact local settings used by generation are sent with the published HTML", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
  globalThis.fetch = vi.fn(async (url) => ({
    ok: true,
    json: async () =>
      String(url).includes("/functional-settings/")
        ? {
            functionalSettings: snapshot,
            revision: 7,
            settingsMigration: { state: "complete", source: "local" },
          }
        : { success: true, pagesUrl: "https://example.invalid/" },
  })) as typeof fetch;
  const { props, api } = harness();
  await api.publishWithStorage("owner", "googledrive");
  expect(props.generateExperiment).toHaveBeenCalledWith(
    "googledrive",
    snapshot,
  );
  const [, init] = vi.mocked(fetch).mock.calls[1];
  expect(JSON.parse(init!.body as string).functionalSettings).toEqual(snapshot);
});
