export interface PrecisionComponentActivation {
  /** Timestamp from a real frame-engine callback when available. */
  timestamp: number;
}

export interface PrecisionComponentArm {
  /** Absolute performance-domain activation target when it is known early. */
  scheduledTimestamp?: number | null;
  reason?: string;
}

export interface PrecisionComponentLifecycle {
  prepare(
    container: HTMLElement,
    config: any,
    onResponse: () => void,
  ): Promise<HTMLElement | null>;
  arm(info?: PrecisionComponentArm): void;
  activate(info: PrecisionComponentActivation): void;
  deactivate(info: PrecisionComponentActivation): void;
  collectData(): unknown;
  getReadinessDiagnostics(): PrecisionComponentReadiness;
  destroy(): void;
}

export interface PrecisionComponentReadiness {
  ready: boolean;
  reason: string;
  fallbackReason: string;
  resourceReadyAt: number | null;
  gpuReadyAt: number | null;
}

/**
 * Compatibility adapter for the existing component API. New components can
 * implement the explicit methods directly; legacy components keep `render()`
 * as their prepare/arm adapter until they are migrated individually.
 */
export function createPrecisionComponentLifecycle(
  instance: any,
): PrecisionComponentLifecycle {
  let prepared = false;
  let destroyed = false;
  let readiness: PrecisionComponentReadiness = {
    ready: false,
    reason: "not_prepared",
    fallbackReason: "",
    resourceReadyAt: null,
    gpuReadyAt: null,
  };

  return {
    async prepare(container, config, onResponse) {
      if (destroyed) return null;
      const result =
        typeof instance.prepare === "function"
          ? await instance.prepare(container, config, onResponse)
          : await instance.render(container, config, onResponse);
      const reported =
        config.__precisionGlobalPath === true
          ? instance.getPrecisionReadiness?.()
          : undefined;
      readiness = reported
        ? { ...readiness, ...reported }
        : {
            ready: true,
            reason: "synchronous_component_prepare_complete",
            fallbackReason: "",
            resourceReadyAt: performance.now(),
            gpuReadyAt: null,
          };
      if (!readiness.ready) {
        throw new Error(
          readiness.fallbackReason || readiness.reason || "component_not_ready",
        );
      }
      prepared = true;
      return result instanceof HTMLElement ? result : null;
    },

    arm(info) {
      if (!prepared || destroyed) return;
      instance.arm?.(info);
    },

    activate(info) {
      if (!prepared || destroyed) return;
      instance.activate?.(info);
    },

    deactivate(info) {
      if (!prepared || destroyed) return;
      if (typeof instance.deactivate === "function") {
        instance.deactivate(info);
      } else {
        instance.hide?.();
      }
    },

    collectData() {
      return instance.collectData?.() ?? null;
    },

    getReadinessDiagnostics() {
      return { ...readiness };
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      instance.destroy?.();
    },
  };
}
