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
      if (!manifest || !address || decision.experimentRevision !== manifest.revision) {
        throw new Error('The saved navigation does not match this experiment revision');
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
          if (resolveAddress(entry.id)?.targetOwnerId !== ownerId ||
              (entry.targetId && !resolveAddress(entry.targetId))) {
            throw new Error('The saved timeline destination is invalid');
          }
        }
      };
      validateQueue(decision.globalRouting.nativeTimeline, null);
      if (finished && decision.globalRouting.nativeTimeline.index !== decision.globalRouting.nativeTimeline.entries.length) {
        throw new Error('A finished route cannot contain future entries');
      }
      for (const frame of decision.loops) validateQueue(frame.routing.nativeTimeline, frame.loopId);
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
