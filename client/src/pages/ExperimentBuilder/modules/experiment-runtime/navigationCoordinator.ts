import { getNavigationCoordinatorKernelCode } from "./navigationCoordinatorKernel";

export type NavigationStorageKeys = {
  jumpRequest: string;
  jumpReload: string;
  resumeTrial: string;
  jumpTarget: string;
  jumpContext: string;
};

const DEFAULT_NAVIGATION_STORAGE_KEYS: NavigationStorageKeys = {
  jumpRequest: "jsPsych_jumpRequest",
  jumpReload: "jsPsych_jumpReload",
  resumeTrial: "jsPsych_resumeTrial",
  jumpTarget: "jsPsych_jumpToTrial",
  jumpContext: "jsPsych_jumpContext",
};

export function getNavigationCoordinatorRuntimeCode(
  storageKeys: Partial<NavigationStorageKeys> = {},
): string {
  const keys: NavigationStorageKeys = {
    jumpRequest:
      storageKeys.jumpRequest ?? DEFAULT_NAVIGATION_STORAGE_KEYS.jumpRequest,
    jumpReload:
      storageKeys.jumpReload ?? DEFAULT_NAVIGATION_STORAGE_KEYS.jumpReload,
    resumeTrial:
      storageKeys.resumeTrial ?? DEFAULT_NAVIGATION_STORAGE_KEYS.resumeTrial,
    jumpTarget:
      storageKeys.jumpTarget ?? DEFAULT_NAVIGATION_STORAGE_KEYS.jumpTarget,
    jumpContext:
      storageKeys.jumpContext ?? DEFAULT_NAVIGATION_STORAGE_KEYS.jumpContext,
  };

  return `
  (() => {
    const JUMP_REQUEST_KEY = ${JSON.stringify(keys.jumpRequest)};
    const JUMP_RELOAD_KEY = ${JSON.stringify(keys.jumpReload)};
    const RESUME_TRIAL_KEY = ${JSON.stringify(keys.resumeTrial)};
    const JUMP_TARGET_KEY = ${JSON.stringify(keys.jumpTarget)};
    const JUMP_CONTEXT_KEY = ${JSON.stringify(keys.jumpContext)};
    const persistedRows = [];
    let pendingJump = null;
    let activeRequest = null;
    let deferredResume = null;
    let invalidStoredJump = false;
    let routingBlocked = false;
    let reloadStarted = false;
    let durabilityCheck = null;
${getNavigationCoordinatorKernelCode()}
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
        localStorage.removeItem(JUMP_TARGET_KEY);
        sessionStorage.removeItem(JUMP_CONTEXT_KEY);
        emit('jump-requested', targetPayload(request));
        if (typeof pauseRuntime === 'function') pauseRuntime();
        reloadWhenDurable();
      },
      consumeReloadMarker() {
        const marked = sessionStorage.getItem(JUMP_RELOAD_KEY) === '1';
        sessionStorage.removeItem(JUMP_RELOAD_KEY);
        sessionStorage.removeItem(JUMP_CONTEXT_KEY);
        const legacyTarget = localStorage.getItem(JUMP_TARGET_KEY);
        localStorage.removeItem(JUMP_TARGET_KEY);
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
        localStorage.removeItem(RESUME_TRIAL_KEY);
        clearJumpStorage();
      }
    });
  })();
`;
}
