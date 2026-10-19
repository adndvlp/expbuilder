import { getNativeTimelinePreviewCode } from "./nativeTimelinePreview";

/** Native timelines own CSV iteration; this coordinator only edits their future entries. */
export function getNativeTimelineNavigationCode(): string {
  return `
    const definitions = new Map();
    const nativeScopes = [];
    const branchDecisions = new WeakMap();
    let nativeRuntime = null;
    let nativeSerial = 0;
    let nativeResume = null;
    let resumeArrived = false;
    let skippedCompletedTarget = false;
    let nativeTransition = null;
    let checkpointNextFrame = null;
    let selectedPreview = false;
    const scopeKey = id => id === null ? 'root' : String(id);
    const scopeSnapshot = scope => ({
      entries: cloneResumeValue(scope.entries), index: scope.index + (checkpointNextFrame === scope ? 1 : 0),
      deferred: scope.deferred || null
    });
    const nativeRootSnapshot = () => nativeScopes.length
      ? scopeSnapshot(nativeScopes[0]) : null;
    const normalEntries = id => {
      const entry = currentManifest()?.entries?.[scopeKey(id)];
      return entry == null ? [] : [{ id: String(entry) }];
    };
    const routeEntries = (ownerId, targetId, options = {}) => {
      const address = resolveAddress(targetId);
      if (!address) throw new Error('Navigation target has no compiled execution address');
      const path = address.enterLoopIds;
      const ownerIndex = ownerId === null ? -1 : path.indexOf(ownerId);
      if (ownerId !== null && ownerIndex < 0) throw new Error('Target is outside the retained scope');
      const entryId = path[ownerIndex + 1] ?? String(targetId);
      const entry = {
        id: entryId, targetId: entryId === String(targetId) ? null : String(targetId),
        parameterTarget: String(targetId), parameters: options.parameters ?? null
      };
      const entries = [entry];
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
        return root;
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
      replaceFuture(common, routeEntries(common.id, String(targetId), options));
      if (nativeScopes.length > commonIndex + 1) {
        const name = nativeScopes[commonIndex + 1].name;
        // Aborted timelines do not run on_timeline_finish: clean their state now.
        closeNativeScopes(commonIndex + 1);
        nativeRuntime.abortTimelineByName(name);
      }
      emit('navigation-transition', { targetId: String(targetId), retainedScope: common.id });
      return common;
    };
    const deferOrdinaryExit = (sourceId, targetId, options) => {
      const frame = nativeScopes[nativeScopes.length - 1];
      const address = resolveAddress(targetId);
      if (!frame || frame.id === null || !options.usedDefault || !address ||
          address.enterLoopIds.includes(frame.id)) return false;
      frame.deferred = { targetId: String(targetId), options };
      replaceFuture(frame, []);
      return true;
    };
    const requestBranch = (data, decision) => {
      branchDecisions.set(data, decision);
      let targetId = decision.targetId;
      if (selectedPreview && targetId != null && targetId !== 'FINISH_EXPERIMENT' && !resolveAddress(targetId)) targetId = null;
      const frame = nativeScopes[nativeScopes.length - 1];
      if (!frame) return;
      const sourceId = data.builder_id ?? data.trial_id ?? null;
      if (targetId == null) {
        replaceFuture(frame, []);
      } else {
        if (targetId !== 'FINISH_EXPERIMENT' && resolveAddress(targetId)?.targetKind !== 'trial') {
          throw new Error('Branch destination must be a compiled trial');
        }
        const options = { parameters: decision.customParameters ?? null,
          usedDefault: Boolean(decision.usedDefault && decision.conditionId == null) };
        emit('branch-decision', { sourceId, targetId, conditionId: decision.conditionId ?? null,
          usedDefault: options.usedDefault });
        if (!deferOrdinaryExit(sourceId, targetId, options)) {
          const retained = performTransition(targetId, options);
          nativeTransition = retained ? { source: data, targetId, frame: retained } : null;
        }
      }
      // on_finish must return so on_data_update can durably acknowledge this result.
      pendingBranch = { source: data, targetId, acknowledged: false };
      nativeRuntime.pauseExperiment();
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
          if (nativeResume && !resumeArrived && entry.id === String(nativeResume.targetId)) {
            resumeArrived = true;
            emit('resume-target-enter', { targetId: resolveAddress(entry.id)?.targetId });
          } else if (entry.parameterTarget === entry.id) {
            emit('branch-target-enter', { targetId: resolveAddress(entry.id)?.targetId });
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
          return true;
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
          scope.deferred = null;
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
          if (deferred &&
              !deferOrdinaryExit(id, deferred.targetId, deferred.options)) {
            performTransition(deferred.targetId, deferred.options);
          } else if (!deferred) {
            const next = currentManifest()?.loopContinuations?.[id];
            const parent = nativeScopes[nativeScopes.length - 1];
            if (parent && next != null) replaceFuture(parent, [{ id: String(next) }]);
          }
        }
      };
    }
    const registerTrial = (id, node) => definitions.set(String(id), { kind: 'trial', node });
    const registerLoop = (id, node, metadata) => definitions.set(String(id), { kind: 'loop', node, metadata });
    const attach = (jsPsych, timeline) => {
      if (!definitions.size) return;
      if (!currentManifest()?.scopes) throw new Error('Unsupported execution manifest');
      nativeRuntime = jsPsych;
      nativeResume = deferredResume;
      if (nativeResume) validateResume(nativeResume);
      skippedCompletedTarget = false;
      resumeArrived = false;
      const savedRoot = nativeResume?.globalRouting.nativeTimeline;
      const entries = savedRoot ? savedRoot.entries.slice(savedRoot.index) : normalEntries(null);
      const root = { id: null, name: 'expbuilder-root', entries, queue: [], index: -1 };
      root.queue = entries.map(entry => makeEntry(root, entry));
      const authored = new Set([...definitions.values()].map(item => item.node));
      const setup = timeline.filter(node => !authored.has(node));
      timeline.splice(0, timeline.length, ...setup, {
        name: root.name, timeline: root.queue,
        on_timeline_start() { nativeScopes.push(root); cursorCheckpointsEnabled = true; }
      });
    };
    ${getNativeTimelinePreviewCode()}
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
