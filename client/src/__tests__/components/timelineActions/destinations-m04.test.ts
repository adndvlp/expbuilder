import { afterEach, beforeEach, expect, test, vi } from "vitest";
import PublishExperiment from "../../../pages/ExperimentBuilder/components/Timeline/PublishExperiment";
import { auth } from "../../../lib/firebase";
import { defaultFunctionalSettings } from "../../../lib/functionalSettings";
vi.mock("../../../lib/functionalSettings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/functionalSettings")>()),
  requireFunctionalSettings: vi.fn(async () => defaultFunctionalSettings()),
}));
const json = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 409, json: async () => body }) as Response;
const context = (patch = {}) => ({
  success: true,
  exists: true,
  projectId: "project",
  experimentID: "study",
  verifiedOwnerUid: "owner",
  storage: {
    state: "bound",
    provider: "dropbox",
    binding: { provider: "dropbox", accountId: "account", folderId: "folder" },
  },
  github: {
    state: "bound",
    binding: {
      repositoryId: "repo",
      accountId: "account",
      ownerLogin: "owner",
      repoName: "original",
      branch: "main",
    },
  },
  ...patch,
});
function harness() {
  const props = {
    experimentID: "study",
    setLastPagesUrl: vi.fn(),
    setPublishStatus: vi.fn(),
    setAvailableStorages: vi.fn(),
    setShowStorageModal: vi.fn(),
    setIsPublishing: vi.fn(),
    getUserTokens: vi.fn(async () => ({
      drive: true,
      dropbox: true,
      osf: true,
      github: true,
    })),
    generateExperiment: vi.fn(async () => "code"),
    onReviewDestinations: vi.fn(),
  };
  return { props, api: PublishExperiment(props) };
}
beforeEach(() => {
  vi.useFakeTimers();
  (auth as any).currentUser = { uid: "owner", getIdToken: async () => "token" };
  globalThis.fetch = vi.fn(async (url) =>
    json(
      String(url).includes("deployment-context")
        ? context()
        : { success: true, pagesUrl: "https://example.invalid" },
    ),
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
test("bound storage bypasses provider selection and is used before generating code", async () => {
  const { props, api } = harness();
  await api.handlePublishToGitHub();
  expect(props.setShowStorageModal).not.toHaveBeenCalledWith(true);
  expect(props.generateExperiment).toHaveBeenCalledWith(
    "dropbox",
    defaultFunctionalSettings(),
  );
  const call = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => String(url).includes("publish-experiment"));
  expect(JSON.parse(call![1]!.body as string)).toMatchObject({
    storage: "dropbox",
    backendProjectId: "project",
  });
});
test("legacy destinations open review without generating or publishing", async () => {
  vi.mocked(fetch).mockResolvedValue(
    json(context({ github: { state: "needs_selection" } })),
  );
  const { props, api } = harness();
  await api.handlePublishToGitHub();
  expect(props.onReviewDestinations).toHaveBeenCalled();
  expect(props.generateExperiment).not.toHaveBeenCalled();
});
test("a stale provider selection is rejected before generation", async () => {
  const { props, api } = harness();
  await api.publishWithStorage("owner", "googledrive");
  expect(props.generateExperiment).not.toHaveBeenCalled();
  expect(props.setPublishStatus).toHaveBeenCalledWith(
    expect.stringContaining("linked"),
  );
});
test("a returned identity for another signed in user is rejected", async () => {
  vi.mocked(fetch).mockResolvedValue(
    json(context({ verifiedOwnerUid: "foreign" })),
  );
  const { props, api } = harness();
  await api.handlePublishToGitHub();
  expect(props.generateExperiment).not.toHaveBeenCalled();
  expect(props.setShowStorageModal).not.toHaveBeenCalledWith(true);
});
test("a missing destination endpoint blocks publication and retains a useful error", async () => {
  vi.mocked(fetch).mockResolvedValue({
    ...json(
      { code: "BACKEND_UPGRADE_REQUIRED", message: "Update the backend" },
      false,
    ),
    status: 426,
  });
  const { props, api } = harness();
  await api.publishWithStorage("owner", "dropbox");
  expect(props.generateExperiment).not.toHaveBeenCalled();
  vi.advanceTimersByTime(5000);
  expect(props.setPublishStatus).not.toHaveBeenCalledWith("");
});
test("a pending repair opens recovery before generating public code", async () => {
  vi.mocked(fetch).mockResolvedValue(
    json(context({ pendingRepair: { resource: "github" } })),
  );
  const { props, api } = harness();
  await api.handlePublishToGitHub();
  expect(props.onReviewDestinations).toHaveBeenCalled();
  expect(props.generateExperiment).not.toHaveBeenCalled();
  expect(props.setShowStorageModal).not.toHaveBeenCalledWith(true);
});
