import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  loop,
  okJson,
  timelineLoop,
  timelineTrial,
  trial,
} from "../../helpers/trialFactories";
import {
  queueFetchResponses,
  registerTrialsProviderLifecycle,
  renderLoadedProvider,
} from "./testHarness";

describe("TrialsProvider save stability", () => {
  registerTrialsProviderLifecycle();

  it("preserves the root timeline across every nonvisual save method", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Trial" }),
      timelineLoop({ id: 2, name: "Loop" }),
    ]);
    const initialTimeline = view.getContext()?.timeline;
    const updatedTrial = trial({
      id: 1,
      name: "Trial",
      parameters: { stimulus: "updated" },
    });
    const updatedLoop = loop({
      id: 2,
      name: "Loop",
      repetitions: 3,
    });

    act(() => view.getContext()?.setSelectedTrial(updatedTrial));
    queueFetchResponses(
      okJson({ trial: updatedTrial }),
      okJson({ trial: updatedTrial }),
    );
    await act(async () => {
      await view
        .getContext()
        ?.updateTrial(1, { parameters: updatedTrial.parameters });
      await view
        .getContext()
        ?.updateTrialField(1, "columnMapping", { stimulus: "csv" });
    });

    act(() => view.getContext()?.setSelectedLoop(updatedLoop));
    queueFetchResponses(
      okJson({ loop: updatedLoop }),
      okJson({ loop: updatedLoop }),
    );
    await act(async () => {
      await view.getContext()?.updateLoop(2, { repetitions: 3 });
      await view.getContext()?.updateLoopField(2, "csvJson", [["value"]]);
    });

    expect(view.getContext()?.timeline).toBe(initialTimeline);
    expect(view.getContext()?.selectedTrial).toEqual(updatedTrial);
    expect(view.getContext()?.selectedLoop).toEqual(updatedLoop);
  });

  it("preserves a nested timeline across repeated trial and loop saves", async () => {
    const view = await renderLoadedProvider([
      timelineLoop({
        id: "parent",
        name: "Parent",
        trials: [10, "child"],
      }),
    ]);
    const nestedTrial = trial({
      id: 10,
      name: "Nested Trial",
      parentLoopId: "parent",
    });
    const nestedLoop = loop({
      id: "child",
      name: "Nested Loop",
      parentLoopId: "parent",
    });

    queueFetchResponses(
      okJson({
        trialsMetadata: [
          timelineTrial({
            id: 10,
            name: "Nested Trial",
            parentLoopId: "parent",
          }),
          timelineLoop({
            id: "child",
            name: "Nested Loop",
            parentLoopId: "parent",
          }),
        ],
      }),
    );
    await act(async () => {
      await view.getContext()?.getLoopTimeline("parent");
    });
    const initialLoopTimeline = view.getContext()?.loopTimeline;

    act(() => view.getContext()?.setSelectedTrial(nestedTrial));
    queueFetchResponses(
      ...Array.from({ length: 12 }, () => okJson({ trial: nestedTrial })),
    );
    await act(async () => {
      for (let index = 0; index < 12; index += 1) {
        await view
          .getContext()
          ?.updateTrialField(10, "parameters", { revision: index });
      }
    });

    act(() => view.getContext()?.setSelectedLoop(nestedLoop));
    queueFetchResponses(
      ...Array.from({ length: 12 }, () => okJson({ loop: nestedLoop })),
    );
    await act(async () => {
      for (let index = 0; index < 12; index += 1) {
        await view
          .getContext()
          ?.updateLoopField("child", "loopConditions", [{ revision: index }]);
      }
    });

    expect(view.getContext()?.loopTimeline).toBe(initialLoopTimeline);
  });
});
