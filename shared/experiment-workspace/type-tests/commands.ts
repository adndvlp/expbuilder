import { applyWorkspaceCommand } from "../dist/commands.js";
import type { WorkspaceDocument } from "../dist/types.js";

declare const document: WorkspaceDocument;
const added = applyWorkspaceCommand(document, {
  kind: "addTrial",
  args: { position: { x: 10, y: 20 } },
});
export const newId: string | number = added.result;

// @ts-expect-error A command name must be a supported discriminant.
applyWorkspaceCommand(document, { kind: "inventedCommand" });
// @ts-expect-error Connection endpoints are required.
applyWorkspaceCommand(document, { kind: "connect", args: { sourceId: 1 } });
applyWorkspaceCommand(document, {
  kind: "addChild",
  // @ts-expect-error Placement modes are a closed set.
  args: { sourceId: 1, mode: "diagonal" },
});
// @ts-expect-error Adding a trial does not return a clipboard result.
export const clipboardIds: string[] = added.result.ids;
