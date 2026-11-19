export type WorkspaceSelection =
  | { type: "item"; id: string }
  | { type: "edge"; id: string }
  | { type: "items"; ids: string[] }
  | null;
export function selectWorkspaceItem(
  selection: WorkspaceSelection,
  id: string | number | null,
  previousId?: string | number,
): WorkspaceSelection {
  if (id !== null)
    return selection?.type === "item" && selection.id === String(id)
      ? selection
      : { type: "item", id: String(id) };
  return selection?.type === "item" && selection.id === String(previousId)
    ? null
    : selection;
}
