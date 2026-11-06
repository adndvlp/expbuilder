import type { ModelState } from "../../../../../../../shared/experiment-workspace/dist/types.js";
import { required } from "../../../../../../../shared/experiment-workspace/dist/valueUtils.js";
import type { Candidate, Proposal } from "./types";
import { applyWorkspaceCommand } from "../../../../../../../shared/experiment-workspace/dist/commands.js";
import {
  modelDocument,
  toModel,
} from "../../../../../../../shared/experiment-workspace/dist/documentAdapter.js";
import { layout } from "./layout.js";
import { insertionEndpoints } from "./insertion.js";
export function previewInsertion(
  state: ModelState,
  itemId: string,
  candidate: Candidate,
): Proposal {
  const document = {
    ...modelDocument(state),
    workspaceSchemaVersion: 2,
    editorLayout: { positionsByItemId: state.anchors },
  };
  const response = applyWorkspaceCommand(
    document,
    {
      kind: "insertStructure",
      args: {
        ...candidate,
        itemId,
        endpoints: required(insertionEndpoints(state, itemId)),
      },
    },
    { layout, insertionEndpoints },
  );
  const proposed = toModel(response.document);
  proposed.loops.forEach((loop) => {
    loop.expanded =
      state.loops.find((previous) => previous.id === loop.id)?.expanded ??
      false;
  });
  return { ...response.result, state: proposed, layout: layout(proposed) };
}
