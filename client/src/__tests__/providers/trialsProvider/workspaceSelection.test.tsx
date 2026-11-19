import "../../helpers/legacyGraphTransport";
import { act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  registerTrialsProviderLifecycle,
  renderLoadedProvider,
} from "./testHarness";
import { trial } from "../../helpers/trialFactories";
registerTrialsProviderLifecycle();
describe("workspace selection shared with the configuration panel", () => {
  it("selecting from another app view updates the canvas selection", async () => {
    const view = await renderLoadedProvider();
    await act(async () =>
      view.getContext()!.setSelectedTrial(trial({ id: 4 })),
    );
    expect(view.getContext()!.workspaceSelection).toEqual({
      type: "item",
      id: "4",
    });
  });
  it("clearing panel records for an edge does not erase the edge selection", async () => {
    const view = await renderLoadedProvider();
    await act(async () =>
      view.getContext()!.setSelectedTrial(trial({ id: 4 })),
    );
    await act(async () =>
      view.getContext()!.setWorkspaceSelection({ type: "edge", id: "edge" }),
    );
    await act(async () => view.getContext()!.setSelectedTrial(null));
    expect(view.getContext()!.workspaceSelection).toEqual({
      type: "edge",
      id: "edge",
    });
  });
});
