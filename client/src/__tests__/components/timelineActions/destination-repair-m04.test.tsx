import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import DestinationRepair from "../../../pages/ExperimentBuilder/components/Timeline/DestinationRepair";
import { deploymentRequest } from "../../../lib/deploymentBindings";
vi.mock("../../../lib/deploymentBindings", () => ({
  deploymentRequest: vi.fn(),
}));
const context: any = {
  projectId: "project",
  storage: {
    state: "bound",
    binding: { folderId: "old", accountId: "account" },
  },
  github: { state: "bound", binding: { repositoryId: "123" } },
};
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());
test("requires preview and acknowledgement before creating a replacement", async () => {
  const preview = {
    kind: "repair",
    resource: "storage",
    accountId: "account",
    accountLabel: "Researcher",
    previous: { folderId: "old" },
    fingerprint: "preview",
    contextFingerprint: "original",
    selection: {},
  };
  vi.mocked(deploymentRequest)
    .mockResolvedValueOnce({ ...context, repairPreview: preview })
    .mockResolvedValueOnce({
      ...context,
      repairResult: { resource: "storage" },
    });
  const saved = vi.fn();
  render(
    <DestinationRepair
      context={context}
      experimentID="study"
      onSaved={saved}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Repair data folder" }));
  await screen.findByText("Researcher");
  expect(saved).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Create replacement folder" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Create replacement folder" }),
  );
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(deploymentRequest).toHaveBeenLastCalledWith(
    "study",
    "repair/confirm",
    {
      resource: "storage",
      selection: {},
      contextFingerprint: "original",
      fingerprint: "preview",
      confirmReplacement: true,
      acknowledgeDataLoss: true,
      backendProjectId: "project",
    },
  );
});
test("an inaccessible resource explains reconnection and never creates a replacement on error", async () => {
  vi.mocked(deploymentRequest).mockRejectedValue(
    new Error("Reconnect the linked account."),
  );
  render(
    <DestinationRepair
      context={context}
      experimentID="study"
      onSaved={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Repair GitHub repository" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.getByRole("link", { name: "Reconnect accounts in Settings" }),
  ).toHaveAttribute("href", "#/settings");
  expect(
    screen.queryByRole("button", { name: "Create replacement repository" }),
  ).toBeNull();
  expect(deploymentRequest).toHaveBeenCalledTimes(1);
});
test("an interrupted repair exposes inspection of the possible existing replacement", async () => {
  const preview = {
    kind: "repair",
    resource: "github",
    accountId: "9",
    previous: { ownerLogin: "owner", repoName: "old" },
    selection: {},
    fingerprint: "preview",
    contextFingerprint: "context",
  };
  vi.mocked(deploymentRequest)
    .mockResolvedValueOnce({ ...context, repairPreview: preview })
    .mockRejectedValueOnce(new Error("Repository creation was interrupted."))
    .mockResolvedValueOnce({
      ...context,
      pendingRepair: { resource: "github" },
    });
  render(
    <DestinationRepair
      context={context}
      experimentID="study"
      onSaved={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Repair GitHub repository" }),
  );
  await screen.findByRole("checkbox");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Create replacement repository" }),
  );
  await screen.findByRole("button", { name: "Inspect existing replacement" });
  expect(screen.getByPlaceholderText("GitHub owner/repository")).toBeTruthy();
});
