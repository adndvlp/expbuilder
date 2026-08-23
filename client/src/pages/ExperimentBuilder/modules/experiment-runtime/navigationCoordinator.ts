export function getNavigationCoordinatorRuntimeCode(): string {
  return `
  (() => {
    const persistedRows = [];
    let pendingJump = null;
    let reloadStarted = false;
    let durabilityCheck = null;

    const normalizeId = value =>
      value === undefined || value === null ? null : String(value);
    const rowIds = row => [row?.builder_id, row?.trial_id, row?.loop_id]
      .map(normalizeId)
      .filter(value => value !== null);
    const rowMatches = (row, jump) => {
      const sourceId = normalizeId(jump.sourceId);
      const sourceTrialIndex = normalizeId(jump.sourceTrialIndex);
      const rowTrialIndex = normalizeId(row?.trial_index);
      if (sourceTrialIndex !== null && rowTrialIndex !== null &&
          sourceTrialIndex !== rowTrialIndex) {
        return false;
      }
      return sourceId === null || rowIds(row).includes(sourceId);
    };
    const emit = (type, payload) => {
      window.ExpBuilderRuntime?.emit(type, payload || {});
    };
    const reloadWhenDurable = () => {
      if (!pendingJump || reloadStarted) return;
      const persisted = persistedRows.find(row => rowMatches(row, pendingJump));
      if (!persisted || durabilityCheck) return;
      const jump = pendingJump;
      durabilityCheck = (async () => {
        await window.ExpBuilderPersistence?.whenIdle?.();
        if (reloadStarted || pendingJump !== jump) return;
        const sourceIsDurable = persistedRows.some(row => rowMatches(row, jump));
        if (!sourceIsDurable) return;
        reloadStarted = true;
        emit('jump-persisted', jump);
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
        const normalizedTarget = normalizeId(targetId);
        if (normalizedTarget === null) {
          throw new Error('A jump target is required');
        }
        const row = sourceData || {};
        pendingJump = {
          ...(context || {}),
          sourceId: normalizeId(
            context?.sourceId ?? row.builder_id ?? row.trial_id ?? row.loop_id
          ),
          sourceTrialIndex: normalizeId(row.trial_index),
          targetId: normalizedTarget
        };
        localStorage.setItem('jsPsych_jumpToTrial', normalizedTarget);
        sessionStorage.setItem('jsPsych_jumpReload', '1');
        sessionStorage.setItem(
          'jsPsych_jumpContext',
          JSON.stringify(pendingJump)
        );
        emit('jump-requested', pendingJump);
        if (typeof pauseRuntime === 'function') pauseRuntime();
        reloadWhenDurable();
      },
      onTrialPersisted(data) {
        persistedRows.push(data || {});
        reloadWhenDurable();
      },
      isTransitionPending() {
        return pendingJump !== null;
      }
    });
  })();
`;
}
