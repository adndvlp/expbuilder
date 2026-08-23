export function getNavigationCoordinatorRuntimeCode(): string {
  return `
  (() => {
    const JUMP_REQUEST_KEY = 'jsPsych_jumpRequest';
    const JUMP_RELOAD_KEY = 'jsPsych_jumpReload';
    const persistedRows = [];
    let pendingJump = null;
    let activeRequest = null;
    let deferredResume = null;
    let invalidStoredJump = false;
    let routingBlocked = false;
    let reloadStarted = false;
    let durabilityCheck = null;

    const normalizeId = value =>
      value === undefined || value === null ? null : String(value);
    const emit = (type, payload) => {
      window.ExpBuilderRuntime?.emit(type, payload || {});
    };
    const targetPayload = request => ({
      ...(request?.context || {}),
      sourceId: request?.sourceId ?? null,
      sourceTrialIndex: request?.sourceTrialIndex ?? null,
      targetId: request?.address?.targetId ?? null,
      targetKind: request?.address?.targetKind ?? null,
      progress: request?.cursor?.progress ?? null
    });
    const readStoredJump = () => {
      const raw = localStorage.getItem(JUMP_REQUEST_KEY);
      if (!raw) return { request: null, invalid: false };
      const request = window.ExpBuilderJumpProtocol.parse(raw);
      return { request, invalid: request === null };
    };
    const initialJump = readStoredJump();
    activeRequest = initialJump.request;
    invalidStoredJump = initialJump.invalid;

    const persistActiveJump = request => {
      if (request) {
        localStorage.setItem(JUMP_REQUEST_KEY, JSON.stringify(request));
      } else {
        localStorage.removeItem(JUMP_REQUEST_KEY);
      }
    };
    const clearJumpStorage = () => {
      localStorage.removeItem(JUMP_REQUEST_KEY);
      sessionStorage.removeItem(JUMP_RELOAD_KEY);
      localStorage.removeItem('jsPsych_jumpToTrial');
      sessionStorage.removeItem('jsPsych_jumpContext');
    };
    const invalidateNavigation = (reason, request) => {
      const payload = targetPayload(request || activeRequest);
      activeRequest = null;
      pendingJump = null;
      deferredResume = null;
      invalidStoredJump = false;
      routingBlocked = true;
      clearJumpStorage();
      emit('jump-invalidated', { ...payload, reason });
    };
    const currentManifest = () => {
      const manifest = window.ExpBuilderExecutionAddresses;
      return manifest && manifest.version === 2 ? manifest : null;
    };
    const resolveAddress = targetId => {
      const manifest = currentManifest();
      const normalizedTarget = normalizeId(targetId);
      if (!manifest || normalizedTarget === null) return null;
      return manifest.addressesByTarget?.[normalizedTarget] ?? null;
    };
    const requestMatchesManifest = (request, manifest) => {
      const compiled = manifest.addressesByTarget?.[
        String(request.address.targetId)
      ];
      if (!compiled) return false;
      return compiled.targetKind === request.address.targetKind &&
        compiled.targetOwnerId === request.address.targetOwnerId &&
        compiled.enterLoopIds.length === request.address.enterLoopIds.length &&
        compiled.enterLoopIds.every(
          (loopId, index) => loopId === request.address.enterLoopIds[index]
        );
    };
    const materializeResume = () => {
      if (activeRequest || !deferredResume) return;
      const manifest = currentManifest();
      const address = resolveAddress(deferredResume.targetId);
      if (!manifest || !address) {
        invalidateNavigation('RESUME_ADDRESS_NOT_FOUND', null);
        return;
      }
      activeRequest = window.ExpBuilderJumpProtocol.create(
        address,
        manifest.revision,
        deferredResume.sourceId ?? null,
        null,
        {
          navigationKind: 'resume',
          routeKind: deferredResume.kind,
          conditionId: deferredResume.conditionId ?? null
        }
      );
      deferredResume = null;
    };
    const getActiveRequest = () => {
      materializeResume();
      if (!activeRequest) return null;
      const manifest = currentManifest();
      if (manifest && activeRequest.experimentRevision !== manifest.revision) {
        invalidateNavigation('JUMP_REVISION_MISMATCH', activeRequest);
        return null;
      }
      if (manifest && !requestMatchesManifest(activeRequest, manifest)) {
        invalidateNavigation('JUMP_ADDRESS_NOT_FOUND', activeRequest);
        return null;
      }
      return activeRequest;
    };

    const rowIds = row => [row?.builder_id, row?.trial_id, row?.loop_id]
      .map(normalizeId)
      .filter(value => value !== null);
    const rowMatches = (row, request) => {
      const sourceId = normalizeId(request.sourceId);
      const sourceTrialIndex = normalizeId(request.sourceTrialIndex);
      const rowTrialIndex = normalizeId(row?.trial_index);
      if (sourceTrialIndex !== null && rowTrialIndex !== null &&
          sourceTrialIndex !== rowTrialIndex) {
        return false;
      }
      return sourceId === null || rowIds(row).includes(sourceId);
    };
    const reloadWhenDurable = () => {
      if (!pendingJump || reloadStarted) return;
      const persisted = persistedRows.find(row => rowMatches(row, pendingJump));
      if (!persisted || durabilityCheck) return;
      const jump = pendingJump;
      durabilityCheck = (async () => {
        await window.ExpBuilderPersistence?.whenIdle?.();
        if (reloadStarted || pendingJump !== jump) return;
        const durable = persistedRows.some(row => rowMatches(row, jump));
        if (!durable) return;
        reloadStarted = true;
        emit('jump-persisted', targetPayload(jump));
        window.location.reload();
      })()
        .catch(error => {
          window.ExpBuilderRuntime?.reportError(error, {
            source: 'jump-persistence-barrier'
          });
        })
        .finally(() => {
          durabilityCheck = null;
        });
    };

    window.ExpBuilderNavigation = Object.freeze({
      requestJump(targetId, context, sourceData, pauseRuntime) {
        const manifest = currentManifest();
        const address = resolveAddress(targetId);
        if (!manifest || !address) {
          throw new Error('Jump target has no compiled execution address');
        }
        const row = sourceData || {};
        const request = window.ExpBuilderJumpProtocol.create(
          address,
          manifest.revision,
          context?.sourceId ?? row.builder_id ?? row.trial_id ?? row.loop_id,
          row.trial_index,
          { ...(context || {}), navigationKind: 'jump' }
        );
        routingBlocked = false;
        invalidStoredJump = false;
        pendingJump = request;
        activeRequest = request;
        persistActiveJump(request);
        sessionStorage.setItem(JUMP_RELOAD_KEY, '1');
        localStorage.removeItem('jsPsych_jumpToTrial');
        sessionStorage.removeItem('jsPsych_jumpContext');
        emit('jump-requested', targetPayload(request));
        if (typeof pauseRuntime === 'function') pauseRuntime();
        reloadWhenDurable();
      },
      consumeReloadMarker() {
        const marked = sessionStorage.getItem(JUMP_RELOAD_KEY) === '1';
        sessionStorage.removeItem(JUMP_RELOAD_KEY);
        sessionStorage.removeItem('jsPsych_jumpContext');
        const legacyTarget = localStorage.getItem('jsPsych_jumpToTrial');
        localStorage.removeItem('jsPsych_jumpToTrial');
        if (invalidStoredJump || legacyTarget !== null) {
          invalidateNavigation(
            marked
              ? 'JUMP_RELOAD_WITHOUT_VALID_REQUEST'
              : 'JUMP_REQUEST_INVALID',
            activeRequest
          );
          return { status: 'invalid', request: null };
        }
        if (!activeRequest) {
          if (marked) {
            invalidateNavigation(
              'JUMP_RELOAD_WITHOUT_VALID_REQUEST',
              activeRequest
            );
            return { status: 'invalid', request: null };
          }
          return { status: 'none', request: null };
        }
        const observed = window.ExpBuilderJumpProtocol.observeReload(
          activeRequest
        );
        if (observed.status === 'stalled') {
          invalidateNavigation('JUMP_STALLED', activeRequest);
          return { status: 'stalled', request: null };
        }
        activeRequest = observed.request;
        persistActiveJump(activeRequest);
        emit('jump-reload-ready', targetPayload(activeRequest));
        return {
          status: marked ? 'ready' : 'active',
          request: activeRequest
        };
      },
      activateResume(decision) {
        if (!decision?.targetId || activeRequest || pendingJump) return false;
        deferredResume = { ...decision, targetId: String(decision.targetId) };
        return true;
      },
      allowsItem(itemId, itemKind) {
        if (routingBlocked) return false;
        const request = getActiveRequest();
        if (routingBlocked) return false;
        if (!request) return null;
        return window.ExpBuilderJumpProtocol.allows(request, itemId, itemKind);
      },
      enterItem(itemId, itemKind) {
        if (routingBlocked) return false;
        const request = getActiveRequest();
        if (routingBlocked) return false;
        if (!request) return null;
        const result = window.ExpBuilderJumpProtocol.enter(
          request,
          itemId,
          itemKind
        );
        if (!result.allowed) return false;
        const navigationKind = request.context?.navigationKind ?? 'jump';
        if (result.consumed === 'segment' && result.request) {
          activeRequest = result.request;
          if (navigationKind === 'jump') persistActiveJump(activeRequest);
          emit('jump-segment-consumed', {
            ...targetPayload(activeRequest),
            segmentId: result.segmentId
          });
        } else if (result.consumed === 'target') {
          activeRequest = null;
          deferredResume = null;
          if (navigationKind === 'jump') persistActiveJump(null);
          emit(
            navigationKind === 'resume'
              ? 'resume-target-enter'
              : 'jump-target-enter',
            targetPayload(request)
          );
        }
        return true;
      },
      onTrialPersisted(data) {
        persistedRows.push(data || {});
        reloadWhenDurable();
      },
      isTransitionPending() {
        return pendingJump !== null;
      },
      clearTransientState() {
        pendingJump = null;
        activeRequest = null;
        deferredResume = null;
        invalidStoredJump = false;
        routingBlocked = false;
        reloadStarted = false;
        localStorage.removeItem('jsPsych_resumeTrial');
        clearJumpStorage();
      }
    });
  })();
`;
}
