import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BranchConditions from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions";
import { trial } from "../../helpers/trialFactories";

const state = vi.hoisted(() => ({
  timeline: [] as any[],
  loopTimeline: [] as any[],
}));
vi.mock("../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => state,
}));
vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList",
  () => ({
    default: (props: any) => (
      <output data-testid="targets">
        {JSON.stringify({
          branches: props.branchTrials,
          isJump: props.isJumpCondition(props.conditions[0]),
          selected: props.selectedTrial?.id,
        })}
      </output>
    ),
  }),
);

describe("branch configuration preserves trial destinations across containment", () => {
  it.each(["inside", "outside"])(
    "keeps parameters enabled for a saved trial destination %s a loop",
    (placement) => {
      const target = {
        id: "target",
        type: "trial",
        name: "Target",
        parentLoopId: placement === "inside" ? "container" : null,
      };
      state.timeline =
        placement === "inside"
          ? [
              { id: "source", type: "trial", name: "Source" },
              {
                id: "container",
                type: "loop",
                name: "Container",
                trials: ["target"],
              },
            ]
          : [
              {
                id: "container",
                type: "loop",
                name: "Container",
                trials: ["source"],
              },
              target,
            ];
      state.loopTimeline =
        placement === "inside"
          ? [target]
          : [{ id: "source", type: "trial", name: "Source" }];
      const source = trial({
        id: "source",
        name: "Source",
        branches: ["target"],
        parentLoopId: placement === "outside" ? "container" : null,
      });
      render(
        <BranchConditions
          selectedTrial={source}
          conditions={[
            {
              id: 1,
              rules: [],
              nextTrialId: "target",
              customParameters: { duration: { source: "typed", value: 12 } },
            },
          ]}
          setConditions={vi.fn()}
          loadTargetTrialParameters={vi.fn(async () => {})}
          findTrialById={vi.fn(() => trial(target))}
          targetTrialParameters={{
            target: [{ key: "duration", label: "Duration", type: "number" }],
          }}
          targetTrialCsvColumns={{}}
          data={[]}
          getAvailableTrials={() => []}
        />,
      );
      const targets = JSON.parse(screen.getByTestId("targets").textContent!);
      expect(targets.branches).toContainEqual({
        id: "target",
        name: "Target",
        isLoop: false,
      });
      expect(targets.isJump).toBe(false);
    },
  );
});
