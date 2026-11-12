export function getNavigationCoordinatorKernelCode(): string {
  return `
    const normalizeId = value => value == null ? null : String(value);
    const emit = (type, payload) => window.ExpBuilderRuntime?.emit(type, payload || {});
    const currentManifest = () => {
      const manifest = window.ExpBuilderExecutionAddresses;
      return manifest?.version === 3 ? manifest : null;
    };
    const resolveAddress = targetId =>
      currentManifest()?.addressesByTarget?.[normalizeId(targetId)] ?? null;
    const validateResume = decision => {
      const manifest = currentManifest();
      const finished = decision.targetId === "FINISH_EXPERIMENT";
      const address = finished ? { enterLoopIds: [] } : resolveAddress(decision.targetId);
      // Authoring revisions also change for names and presentation. Validate
      // the saved execution references against the current manifest instead.
      if (!manifest || !address) {
        throw new Error('The saved navigation destination does not match this experiment');
      }
      if (address.enterLoopIds.length < decision.loops.length ||
          decision.loops.some((frame, index) => address.enterLoopIds[index] !== frame.loopId)) {
        throw new Error('The saved navigation has an invalid loop path');
      }
      const validateQueue = (state, ownerId) => {
        if (!state || !Array.isArray(state.entries) || !Number.isInteger(state.index) ||
            state.index < 0 || state.index > state.entries.length) {
          throw new Error('The saved timeline cursor is invalid');
        }
        for (const entry of state.entries) {
          const entryAddress = resolveAddress(entry.id);
          const target = entry.targetId == null ? null : resolveAddress(entry.targetId);
          if (entryAddress?.targetOwnerId !== ownerId ||
              (entry.targetId != null && (entryAddress.targetKind !== 'loop' ||
                !target?.enterLoopIds.includes(String(entry.id))))) {
            throw new Error('The saved timeline destination is invalid');
          }
        }
        if (state.deferred && state.deferred.targetId !== 'FINISH_EXPERIMENT' &&
            resolveAddress(state.deferred.targetId)?.targetKind !== 'trial') {
          throw new Error('The saved timeline destination is invalid');
        }
      };
      validateQueue(decision.globalRouting.nativeTimeline, null);
      if (finished && decision.globalRouting.nativeTimeline.index !== decision.globalRouting.nativeTimeline.entries.length) {
        throw new Error('A finished route cannot contain future entries');
      }
      for (const frame of decision.loops) {
        const loop = definitions.get(frame.loopId);
        if (loop?.kind !== 'loop' || !Array.isArray(loop.node.timeline_variables) ||
            frame.order.length !== loop.node.timeline_variables.length ||
            frame.order.some(index => index >= loop.node.timeline_variables.length)) {
          throw new Error('The saved loop order does not match its stimuli');
        }
        // The generated getter validates saved repetitions before any trial runs.
        void loop.node.repetitions;
        validateQueue(frame.routing.nativeTimeline, frame.loopId);
      }
      if (!finished) {
        const queues = [decision.globalRouting.nativeTimeline, ...decision.loops.map(frame => frame.routing.nativeTimeline)];
        for (const [depth, queue] of queues.entries()) {
          const expected = address.enterLoopIds[depth] ?? String(decision.targetId);
          if (queue.entries[queue.index]?.id !== expected) {
            throw new Error('The saved timeline cursor does not reach its destination');
          }
        }
      }
    };
    const acknowledgeBranch = data => {
      const request = pendingBranch;
      if (!request || request.acknowledged ||
          String(data?.builder_id ?? data?.trial_id) !== String(request.source.builder_id ?? request.source.trial_id) ||
          data?.trial_index !== request.source.trial_index) return;
      request.acknowledged = true;
      Promise.resolve().then(() => window.ExpBuilderPersistence?.whenIdle?.()).then(() => {
        if (pendingBranch !== request) return;
        pendingBranch = null;
        emit('branch-persisted', { targetId: request.targetId });
        nativeRuntime.resumeExperiment();
      }).catch(error => window.ExpBuilderRuntime?.reportError(error, { source: 'branch-persistence-barrier' }));
    };
`;
}
