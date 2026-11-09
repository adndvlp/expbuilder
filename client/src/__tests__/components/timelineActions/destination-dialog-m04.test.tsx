import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import DestinationDialog from "../../../pages/ExperimentBuilder/components/Timeline/DestinationDialog";
import { deploymentRequest } from "../../../lib/deploymentBindings";
vi.mock("../../../lib/deploymentBindings", () => ({
  deploymentRequest: vi.fn(),
}));
test("inspects first, displays verified identities, then saves without publishing", async () => {
  const context: any = {
    storage: { state: "needs_confirmation", provider: "googledrive" },
    github: { state: "needs_selection" },
  };
  const preview = {
    selection: { repository: "owner/original", branch: "main" },
    contextFingerprint: "context",
    fingerprint: "preview",
    storage: {
      provider: "googledrive",
      accountId: "drive-account",
      folderId: "folder-id",
      folderName: "Study data",
    },
    github: {
      ownerLogin: "owner",
      repoName: "original",
      repositoryId: "123",
      accountId: "9",
      branch: "main",
    },
  };
  vi.mocked(deploymentRequest)
    .mockResolvedValueOnce({ ...context, preview })
    .mockResolvedValueOnce({
      ...context,
      storage: { state: "bound" },
      github: { state: "bound" },
    });
  const onSaved = vi.fn();
  render(
    <DestinationDialog
      experimentID="study"
      context={context}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Save destinations" }),
  ).toBeNull();
  fireEvent.change(screen.getByLabelText("Original GitHub repository"), {
    target: { value: "owner/original" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Inspect destinations" }));
  await screen.findByText("Study data");
  expect(screen.getByText(/folder-id/)).toBeTruthy();
  expect(screen.getByText(/123/)).toBeTruthy();
  expect(onSaved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save destinations" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(deploymentRequest).toHaveBeenLastCalledWith("study", "confirm", {
    backendProjectId: undefined,
    selection: preview.selection,
    contextFingerprint: "context",
    fingerprint: "preview",
  });
});
