export function getNativeTimelinePreviewCode(): string {
  return `
    const attachPreview = (jsPsych, timeline) => {
      const idsByNode = new Map([...definitions].map(([id, definition]) => [definition.node, id]));
      const scopes = { root: [] };
      const entries = { root: null };
      const loopContinuations = {};
      const addressesByTarget = {};
      const visit = (id, ownerId, path) => {
        if (addressesByTarget[id]) throw new Error('Preview item has multiple owners');
        const definition = definitions.get(id);
        addressesByTarget[id] = { targetId: id, targetKind: definition.kind, targetOwnerId: ownerId, enterLoopIds: path };
        scopes[scopeKey(ownerId)].push(id);
        if (definition.kind === 'loop') {
          scopes[id] = [];
          entries[id] = definition.metadata?.entryItemId == null ? null : String(definition.metadata.entryItemId);
          loopContinuations[id] = definition.metadata?.nextItemId == null ? null : String(definition.metadata.nextItemId);
          for (const child of definition.node.timeline) {
            const childId = idsByNode.get(child);
            if (childId) visit(childId, id, [...path, id]);
          }
        }
      };
      for (const node of timeline) {
        const id = idsByNode.get(node);
        if (id) visit(id, null, []);
      }
      entries.root = scopes.root[0] ?? null;
      window.ExpBuilderExecutionAddresses = {
        version: 3, entries, loopContinuations, revision: 'selected-preview', nextBySource: {}, scopes, allScopes: scopes, addressesByTarget
      };
      selectedPreview = true;
      attach(jsPsych, timeline);
    };
`;
}
