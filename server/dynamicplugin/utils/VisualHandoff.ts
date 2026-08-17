export type VisualHandoffLostReason =
  | "expired_before_consume"
  | "surface_removed"
  | "replaced"
  | "invalid_timestamp"
  | "not_available";

export type VisualHandoffSnapshot = {
  fromTrialSequence: number | null;
  timestamp: number | null;
  available: boolean;
  consumed: boolean;
  lost: boolean;
  lostReason: VisualHandoffLostReason | "";
};

export type VisualHandoff = {
  set(timestamp: number, fromTrialSequence: number): void;
  consume(): VisualHandoffSnapshot;
  clear(reason: VisualHandoffLostReason): void;
  peek(): VisualHandoffSnapshot;
};

/**
 * Owns the persistent visual handoff timestamp and its expiry timer.
 *
 * A handoff timestamp is valid only for the same presentation opportunity.
 * The module records whether a handoff was lost (and why) so the next trial
 * can report it instead of silently falling back to a fresh rAF origin.
 */
export function createVisualHandoff(): VisualHandoff {
  let timestamp: number | null = null;
  let fromTrialSequence: number | null = null;
  let available = false;
  let lost = false;
  let lostReason: VisualHandoffLostReason | "" = "";
  let expiryTimer: number | null = null;

  const clearTimer = () => {
    if (expiryTimer !== null) {
      window.clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  };

  const markLost = (reason: VisualHandoffLostReason) => {
    lost = true;
    lostReason = reason;
    timestamp = null;
    fromTrialSequence = null;
    available = false;
  };

  const resetForNextHandoff = () => {
    clearTimer();
    timestamp = null;
    fromTrialSequence = null;
    available = false;
    lost = false;
    lostReason = "";
  };

  const snapshot = (): VisualHandoffSnapshot => ({
    fromTrialSequence,
    timestamp,
    available,
    consumed: false,
    lost,
    lostReason,
  });

  return {
    set(nextTimestamp: number, nextTrialSequence: number) {
      clearTimer();
      if (!Number.isFinite(nextTimestamp) || nextTimestamp <= 0) {
        markLost("invalid_timestamp");
        return;
      }
      if (available) {
        markLost("replaced");
      }
      timestamp = nextTimestamp;
      fromTrialSequence = nextTrialSequence;
      available = true;
      lost = false;
      lostReason = "";
      expiryTimer = window.setTimeout(() => {
        expiryTimer = null;
        if (!available) return;
        markLost("expired_before_consume");
      }, 0);
    },

    consume(): VisualHandoffSnapshot {
      const result: VisualHandoffSnapshot = {
        fromTrialSequence,
        timestamp,
        available,
        consumed: false,
        lost,
        lostReason,
      };
      if (available && typeof timestamp === "number") {
        result.consumed = true;
      } else if (lost) {
        result.consumed = false;
      }
      resetForNextHandoff();
      return result;
    },

    clear(reason: VisualHandoffLostReason) {
      if (!available && timestamp === null) {
        if (lost) return;
        return;
      }
      clearTimer();
      markLost(reason);
    },

    peek(): VisualHandoffSnapshot {
      return snapshot();
    },
  };
}
