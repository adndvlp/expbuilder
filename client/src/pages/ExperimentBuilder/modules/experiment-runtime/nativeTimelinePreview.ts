export function getNativeTimelinePreviewCode(): string {
  return `
    const attachPreview = (jsPsych, timeline) => {
      const idsByNode = new Map([...definitions].map(([id, definition]) => [definition.node, id]));
      const scopes = { root: [] };
      const addressesByTarget = {};
      const visit = (id, ownerId, path) => {
        if (addressesByTarget[id]) throw new Error('Preview item has multiple owners');
        const definition = definitions.get(id);
        addressesByTarget[id] = { targetId: id, targetKind: definition.kind, targetOwnerId: ownerId, enterLoopIds: path };
        scopes[scopeKey(ownerId)].push(id);
        if (definition.kind === 'loop') {
          scopes[id] = [];
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
      window.ExpBuilderExecutionAddresses = {
        version: 2, revision: 'selected-preview', nextBySource: {}, scopes, allScopes: scopes, addressesByTarget
      };
      selectedPreview = true;
      attach(jsPsych, timeline);
    };
`;
}
