/** Native timelines own CSV iteration; this coordinator only edits their future entries. */
export function getNativeTimelineNavigationCode(): string {
  return `
    const definitions = new Map();
    const nativeScopes = [];
    const branchDecisions = new WeakMap();
    let nativeRuntime = null;
    let nativeSerial = 0;
    let nativeResume = null;
    let skippedCompletedTarget = false;
    let nativeTransition = null;
    let checkpointNextFrame = null;
    let selectedPreview = false;
    const scopeKey = id => id === null ? 'root' : String(id);
    const scopeItems = id => currentManifest()?.scopes?.[scopeKey(id)] || [];
    const scopeSnapshot = scope => ({
      entries: cloneResumeValue(scope.entries), index: scope.index + (checkpointNextFrame === scope ? 1 : 0),
      deferred: scope.deferred || null
    });
    const nativeRootSnapshot = () => nativeScopes.length
      ? scopeSnapshot(nativeScopes[0]) : null;
    const firstDescendant = loopId => {
      let id = scopeItems(loopId)[0];
      const visited = new Set();
      while (id && resolveAddress(id)?.targetKind === 'loop') {
        if (visited.has(id)) throw new Error('Cyclic native timeline entry');
        visited.add(id);
        id = scopeItems(id)[0];
      }
      return normalizeId(id);
    };
    const normalEntries = id => scopeItems(id).map(itemId => ({ id: String(itemId), kind: 'normal' }));
    const continuationEntries = (ownerId, itemId) => {
      const all = currentManifest()?.allScopes?.[scopeKey(ownerId)] ?? scopeItems(ownerId);
      const index = all.indexOf(itemId);
      if (index < 0) throw new Error('Timeline continuation has no compiled position');
      const sequential = new Set(scopeItems(ownerId));
      return all.slice(index + 1).filter(id => sequential.has(id))
        .map(id => ({ id, kind: 'normal' }));
    };
    const routeEntries = (ownerId, targetId, options = {}) => {
      const address = resolveAddress(targetId);
      if (!address) throw new Error('Navigation target has no compiled execution address');
      const path = address.enterLoopIds;
      const ownerIndex = ownerId === null ? -1 : path.indexOf(ownerId);
      if (ownerId !== null && ownerIndex < 0) throw new Error('Target is outside the retained scope');
      const entryId = path[ownerIndex + 1] ?? String(targetId);
      const ordinaryLoopEntry = options.usedDefault && entryId !== String(targetId) &&
        firstDescendant(entryId) === String(targetId);
      const entry = {
        id: entryId, targetId: entryId === String(targetId) || ordinaryLoopEntry ? null : String(targetId),
        kind: ordinaryLoopEntry ? 'normal' : options.kind || 'branch',
        stopOwner: Object.hasOwn(options, 'stopOwner') ? options.stopOwner : ownerId,
        parameterTarget: String(targetId), parameters: options.parameters ?? null
      };
      const entries = [entry];
      if (options.kind === 'jump' || options.kind === 'resume') {
        entries.push(...continuationEntries(ownerId, entryId));
      }
      return entries;
    };
    const replaceFuture = (scope, entries) => {
      // Never move or remove an entry at/before the native iterator's cursor.
      scope.entries.splice(scope.index + 1, scope.entries.length, ...entries);
      scope.queue.splice(scope.index + 1, scope.queue.length,
        ...entries.map(entry => makeEntry(scope, entry)));
    };
    const closeNativeScopes = index => {
      const exited = nativeScopes.splice(index);
      for (const scope of exited) {
        preparedLoops.delete(scope.id);
        restoredLoops.delete(scope.id);
      }
      const frameIndex = loopFrames.findIndex(frame => exited.some(scope => scope.id === frame.loopId));
      if (frameIndex !== -1) loopFrames.splice(frameIndex);
      return exited;
    };
    const performTransition = (targetId, options = {}) => {
      if (targetId === 'FINISH_EXPERIMENT') {
        const root = nativeScopes[0];
        replaceFuture(root, []);
        if (nativeScopes.length > 1) {
          const name = nativeScopes[1].name;
          closeNativeScopes(1);
          nativeRuntime.abortTimelineByName(name);
        }
        return;
      }
      const address = resolveAddress(targetId);
      if (!address) throw new Error('Navigation target has no compiled execution address');
      let commonIndex = 0;
      for (let index = 1; index < nativeScopes.length; index++) {
        if (nativeScopes[index].id !== address.enterLoopIds[index - 1]) break;
        commonIndex = index;
      }
      const common = nativeScopes[commonIndex];
      if (!common) throw new Error('There is no active native timeline');
      const sourceEntry = nativeScopes[nativeScopes.length - 1].current;
      const inheritedStop = sourceEntry?.kind === 'branch'
        ? nativeScopes.findIndex(scope => scope.id === sourceEntry.stopOwner) : -1;
      const stopOwner = options.kind === 'branch' && inheritedStop >= 0 && inheritedStop < commonIndex
        ? sourceEntry.stopOwner : common.id;
      replaceFuture(common, routeEntries(common.id, String(targetId), {
        ...options, stopOwner
      }));
      if (nativeScopes.length > commonIndex + 1) {
        const name = nativeScopes[commonIndex + 1].name;
        // Aborted timelines do not run on_timeline_finish: clean their state now.
        closeNativeScopes(commonIndex + 1);
        nativeRuntime.abortTimelineByName(name);
      }
      emit('navigation-transition', { targetId: String(targetId), kind: options.kind, retainedScope: common.id });
      return common;
    };
    const deferOrdinaryExit = (sourceId, targetId, options) => {
      const frame = nativeScopes[nativeScopes.length - 1];
      const ids = frame && scopeItems(frame.id);
      const address = resolveAddress(targetId);
      if (!frame || frame.id === null || !options.usedDefault || !address ||
          ids[ids.length - 1] !== String(sourceId) ||
          address.enterLoopIds.includes(frame.id) ||
          (frame.current?.kind === 'branch' && frame.current.stopOwner !== frame.id)) return false;
      frame.deferred = { targetId: String(targetId), options };
      replaceFuture(frame, []);
      return true;
    };
    const requestBranch = (data, decision) => {
      branchDecisions.set(data, decision);
      const targetId = decision.targetId;
      if (targetId === null || targetId === undefined) return;
      if (selectedPreview && targetId !== 'FINISH_EXPERIMENT' && !resolveAddress(targetId)) return;
      const sourceId = data.builder_id ?? data.trial_id ?? data.loop_id ?? null;
      const options = {
        kind: 'branch', parameters: decision.customParameters ?? null,
        usedDefault: Boolean(decision.usedDefault && decision.conditionId == null)
      };
      emit('branch-decision', { sourceId, targetId, conditionId: decision.conditionId ?? null,
        usedDefault: decision.usedDefault, scope: resolveAddress(sourceId)?.targetOwnerId ?? 'global' });
      if (!deferOrdinaryExit(sourceId, targetId, options)) {
        const frame = performTransition(targetId, options);
        nativeTransition = frame ? { source: data, targetId, frame } : null;
      }
    };
    const completeTrial = (data, mergePoint) => {
      if (!nativeRuntime || pendingJump) return;
      const frame = nativeScopes[nativeScopes.length - 1];
      if (!frame || frame.current?.kind !== 'branch') return;
      if (mergePoint) {
        for (const scope of nativeScopes) {
          replaceFuture(scope, continuationEntries(scope.id, scope.current.id));
          scope.current.kind = 'normal';
        }
        return;
      }
      replaceFuture(frame, []);
      const stopIndex = nativeScopes.findIndex(scope => scope.id === frame.current.stopOwner);
      if (stopIndex !== -1 && stopIndex < nativeScopes.length - 1) {
        const name = nativeScopes[stopIndex + 1].name;
        closeNativeScopes(stopIndex + 1);
        nativeRuntime.abortTimelineByName(name);
      }
    };
    const takeParameters = targetId => {
      for (let index = nativeScopes.length - 1; index >= 0; index--) {
        const entry = nativeScopes[index].current;
        if (entry?.parameterTarget === String(targetId) && entry.parameters) {
          const parameters = entry.parameters;
          for (const scope of nativeScopes) {
            if (scope.current?.parameterTarget === String(targetId)) scope.current.parameters = null;
          }
          return parameters;
        }
      }
      return null;
    };
    function makeEntry(scope, entry) {
      const definition = definitions.get(entry.id);
      if (!definition) throw new Error('Missing compiled timeline definition: ' + entry.id);
      const node = definition.kind === 'loop' ? makeLoop(entry, definition.node) : definition.node;
      return {
        timeline: [node],
        on_timeline_start() {
          scope.index = scope.entries.indexOf(entry);
          scope.current = entry;
          if (activeRequest && String(activeRequest.address.targetId) === entry.id) {
            const request = activeRequest;
            activeRequest = null;
            deferredResume = null;
            persistActiveJump(null);
            sessionStorage.removeItem(JUMP_RELOAD_KEY);
            emit(request.context?.navigationKind === 'resume' ? 'resume-target-enter' : 'jump-target-enter', targetPayload(request));
          }
        },
        conditional_function() {
          if (nativeResume?.afterCompleted && !skippedCompletedTarget &&
              entry.id === String(nativeResume.targetId)) {
            skippedCompletedTarget = true;
            scope.index = scope.entries.indexOf(entry);
            scope.current = entry;
            return false;
          }
          return !routingBlocked;
        }
      };
    }
    function makeLoop(entry, definition) {
      const id = entry.id;
      const name = 'expbuilder-loop-' + id + '-' + (++nativeSerial);
      let scope;
      let savedRow = null;
      let firstRow = true;
      const row = {
        timeline: [],
        on_timeline_start() {
          let entries;
          if (firstRow && savedRow) {
            entries = savedRow.entries.slice(savedRow.index);
            scope.deferred = savedRow.deferred;
          } else if (firstRow && entry.targetId) {
            entries = routeEntries(id, entry.targetId, { ...entry, parameters: entry.parameters });
          } else entries = normalEntries(id);
          firstRow = false;
          scope.index = -1;
          scope.entries = entries;
          scope.queue = row.timeline;
          row.timeline.splice(0, row.timeline.length, ...entries.map(item => makeEntry(scope, item)));
        },
        on_timeline_finish() { finishLoopRow(id); }
      };
      return {
        ...definition, name, timeline: [row],
        on_timeline_start() {
          scope = { id, name, entries: [], queue: row.timeline, index: -1, deferred: null };
          nativeScopes.push(scope);
          startLoop(id, () => ({ nativeTimeline: scopeSnapshot(scope) }), state => {
            savedRow = state.nativeTimeline ?? null;
          });
          definition.on_timeline_start?.();
        },
        on_timeline_finish() {
          const deferred = scope.deferred;
          const index = nativeScopes.indexOf(scope);
          if (index !== -1) nativeScopes.splice(index);
          finishLoop(id);
          definition.on_timeline_finish?.();
          if (deferred && !pendingJump &&
              !deferOrdinaryExit(id, deferred.targetId, deferred.options)) {
            performTransition(deferred.targetId, deferred.options);
          }
        }
      };
    }
    const registerTrial = (id, node) => definitions.set(String(id), { kind: 'trial', node });
    const registerLoop = (id, node) => definitions.set(String(id), { kind: 'loop', node });
    const attach = (jsPsych, timeline) => {
      if (!currentManifest()?.scopes || !definitions.size) return;
      nativeRuntime = jsPsych;
      nativeResume = deferredResume;
      if (nativeResume?.experimentRevision && nativeResume.experimentRevision !== currentManifest().revision) {
        invalidateNavigation('RESUME_REVISION_MISMATCH', null);
      }
      const savedRoot = nativeResume?.globalRouting?.nativeTimeline;
      const target = activeRequest?.address.targetId ?? nativeResume?.targetId;
      let entries = savedRoot ? savedRoot.entries.slice(savedRoot.index) : normalEntries(null);
      if (!savedRoot && target) entries = routeEntries(null, String(target), {
        kind: nativeResume?.kind === 'branch' ? 'branch' : 'resume',
        parameters: nativeResume?.customParameters,
        usedDefault: nativeResume?.usedDefault
      });
      const root = { id: null, name: 'expbuilder-root', entries, queue: [], index: -1 };
      root.queue = entries.map(entry => makeEntry(root, entry));
      const authored = new Set([...definitions.values()].map(item => item.node));
      const setup = timeline.filter(node => !authored.has(node));
      timeline.splice(0, timeline.length, ...setup, {
        name: root.name, timeline: root.queue,
        on_timeline_start() { nativeScopes.push(root); cursorCheckpointsEnabled = true; }
      });
    };
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
    const transitionCheckpoint = (data, fallback) => {
      if (!nativeTransition || nativeTransition.source !== data) return null;
      checkpointNextFrame = nativeTransition.frame;
      try {
        return cursorCheckpoint(nativeTransition.targetId, fallback.completed, false);
      } finally {
        checkpointNextFrame = null;
      }
    };
`;
}
