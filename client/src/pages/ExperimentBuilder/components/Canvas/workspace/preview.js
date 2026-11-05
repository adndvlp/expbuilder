import { applyWorkspaceCommand } from "../../../../../../../shared/experiment-workspace/commands.js";
import {
  modelDocument,
  toModel,
} from "../../../../../../../shared/experiment-workspace/documentAdapter.js";
import { layout } from "./layout.js";
import { insertionEndpoints } from "./insertion.js";
export function previewInsertion(state, itemId, candidate) {
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
        endpoints: insertionEndpoints(state, itemId),
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
