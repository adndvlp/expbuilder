const openEditorModals: symbol[] = [];

export function registerEditorModal(token: symbol) {
  if (!openEditorModals.includes(token)) {
    openEditorModals.push(token);
  }
}

export function unregisterEditorModal(token: symbol) {
  const index = openEditorModals.lastIndexOf(token);
  if (index !== -1) {
    openEditorModals.splice(index, 1);
  }
}

export function isTopmostEditorModal(token: symbol): boolean {
  return openEditorModals[openEditorModals.length - 1] === token;
}

export function isEditorModalOpen(): boolean {
  return openEditorModals.length > 0;
}
