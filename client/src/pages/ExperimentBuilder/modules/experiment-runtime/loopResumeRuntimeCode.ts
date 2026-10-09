export function getLoopResumeRuntimeCode(): string {
  return `
    const loopFrames = [];
    const preparedLoops = new Map();
    let restoredLoops = new Map();
    let cursorCheckpointsEnabled = false;
    const cloneResumeValue = value => JSON.parse(JSON.stringify(value));
    const globalRouteSnapshot = () => ({
      nextTrialId: window.nextTrialId ?? null,
      skipRemaining: Boolean(window.skipRemaining),
      branchingActive: Boolean(window.branchingActive),
      branchUsedDefault: Boolean(window.branchUsedDefault),
      branchCustomParameters: window.branchCustomParameters ?? null
    });
    const loopSnapshots = () => loopFrames.map(frame => ({
      loopId: frame.loopId,
      order: frame.order,
      cursor: frame.cursor,
      repetition: frame.repetition,
      cycleRows: frame.cycleRows,
      routing: frame.readRouting()
    }));
    const cursorCheckpoint = (targetId, completed, afterCompleted) => ({
      version: 2,
      experimentRevision: currentManifest()?.revision ?? null,
      completed,
      cursor: {
        targetId: String(targetId),
        afterCompleted,
        loops: loopSnapshots(),
        globalRouting: globalRouteSnapshot()
      }
    });
    const restoreCursor = decision => {
      if (decision.kind !== 'cursor') return;
      restoredLoops = new Map(decision.loops.map(frame => [frame.loopId, frame]));
      cursorCheckpointsEnabled = true;
    };
    const sampleLoop = (loopId, indices, randomize, conditional) => {
      const key = String(loopId);
      let frame = preparedLoops.get(key);
      if (!frame || !frame.active) {
        const saved = restoredLoops.get(key);
        restoredLoops.delete(key);
        if (saved && (saved.order.some(index => !indices.includes(index)) ||
            saved.order.length !== indices.length)) {
          throw new Error('The saved loop order does not match its stimuli');
        }
        frame = {
          loopId: key,
          repetition: saved?.repetition ?? 0,
          cursor: saved?.cursor ?? 0,
          order: saved?.order ?? null,
          cycleRows: saved?.cycleRows ?? [],
          savedRouting: saved?.routing ?? null,
          conditional,
          repeatCycle: false
        };
        preparedLoops.set(key, frame);
      } else {
        if (!frame.repeatCycle) frame.repetition++;
        frame.cursor = 0;
        frame.order = null;
        frame.cycleRows = [];
        frame.repeatCycle = false;
      }
      if (!frame.order) {
        frame.order = indices.slice();
        if (randomize) {
          for (let index = frame.order.length - 1; index > 0; index--) {
            const other = Math.floor(Math.random() * (index + 1));
            [frame.order[index], frame.order[other]] =
              [frame.order[other], frame.order[index]];
          }
        }
      }
      return frame.order.slice(frame.cursor);
    };
    const remainingLoopRepetitions = (loopId, repetitions) =>
      Math.max(0, repetitions - (restoredLoops.get(String(loopId))?.repetition ?? 0));
    const startLoop = (loopId, readRouting, writeRouting) => {
      const key = String(loopId);
      const frame = preparedLoops.get(key);
      if (!frame) throw new Error('The loop has no sampled execution order');
      frame.readRouting = readRouting;
      frame.active = true;
      if (frame.savedRouting) writeRouting(frame.savedRouting);
      frame.savedRouting = null;
      loopFrames.push(frame);
      cursorCheckpointsEnabled = true;
    };
    const finishLoop = loopId => {
      const key = String(loopId);
      const index = loopFrames.findIndex(frame => frame.loopId === key);
      if (index !== -1) loopFrames.splice(index);
      preparedLoops.delete(key);
    };
    const finishLoopRow = loopId => {
      const frame = preparedLoops.get(String(loopId));
      if (frame) frame.cursor++;
    };
    const finishLoopCycle = (loopId, shouldRepeat) => {
      const frame = preparedLoops.get(String(loopId));
      if (frame) frame.repeatCycle = Boolean(shouldRepeat);
    };
    const loopResults = loopId =>
      preparedLoops.get(String(loopId))?.cycleRows ?? null;
    const checkpointTrialStart = trialData => {
      if (!cursorCheckpointsEnabled || pendingJump) return;
      const targetId = trialData?.builder_id ?? trialData?.trial_id;
      if (targetId === undefined || targetId === null) return;
      let previous = null;
      try {
        previous = JSON.parse(localStorage.getItem(RESUME_TRIAL_KEY) || 'null');
      } catch (_error) { /* A new valid cursor replaces a damaged checkpoint. */ }
      localStorage.setItem(RESUME_TRIAL_KEY, JSON.stringify(cursorCheckpoint(
        targetId, previous?.completed ?? null, false
      )));
    };
    const checkpointTrialComplete = (data, fallback) => {
      if (!cursorCheckpointsEnabled || pendingJump) return fallback;
      for (const frame of loopFrames) {
        if (frame.conditional) frame.cycleRows.push(cloneResumeValue(data));
      }
      return cursorCheckpoint(
        data.builder_id ?? data.trial_id,
        fallback.completed,
        true
      );
    };
`;
}
