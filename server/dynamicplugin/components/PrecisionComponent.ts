export interface PrecisionComponentActivation {
  /** Timestamp from a real frame-engine callback when available. */
  timestamp: number;
}

export interface PrecisionComponentArm {
  /** Absolute performance-domain activation target when it is known early. */
  scheduledTimestamp?: number | null;
  /** Display-frame timestamp selected by the global boundary policy. */
  predictedSelectedFrameTime?: number | null;
  reason?: string;
}

export interface PrecisionComponentLifecycle {
  prepare(
    container: HTMLElement,
    config: any,
    onResponse: () => void,
  ): HTMLElement | null | Promise<HTMLElement | null>;
  arm(info?: PrecisionComponentArm): void;
  activate(info: PrecisionComponentActivation): void;
  deactivate(info: PrecisionComponentActivation): void;
  collectData(): unknown;
  freezeDataForFinalize(): unknown;
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
 * Adapter for the existing component API. It deliberately preserves a
 * synchronous return when preparation is already complete so descriptor-backed
 * runtime materialization cannot escape into an unaccounted microtask.
 */
export function createPrecisionComponentLifecycle(
  instance: any,
  hooks?: {
    /** P1.2 (iteración 6): se invoca exactamente una vez al destruir. */
    onDestroy?: () => void;
  },
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
    prepare(container, config, onResponse) {
      if (destroyed) return null;
      const result =
        typeof instance.prepare === "function"
          ? instance.prepare(container, config, onResponse)
          : instance.render(container, config, onResponse);
      const finalize = (resolved: unknown) => {
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
        return resolved instanceof HTMLElement ? resolved : null;
      };
      return result && typeof result.then === "function"
        ? Promise.resolve(result).then(finalize)
        : finalize(result);
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

    /**
     * P0.3 (iteración 5): snapshot pequeño de aquello que PHASE B necesitará.
     * Los componentes que lo implementan soportan fast retirement (destroy
     * inmediato en PHASE R); los que no, se destruyen en PHASE B.
     */
    freezeDataForFinalize() {
      if (destroyed) return null;
      return typeof instance.freezeDataForFinalize === "function"
        ? instance.freezeDataForFinalize()
        : null;
    },

    getReadinessDiagnostics() {
      return { ...readiness };
    },

    /**
     * P0.2 (iteración 7): contrato de DOS NIVELES de preparación.
     * `resourceReady`/`gpuResourceReady` true significa que la materialización
     * del contexto runtime (bounded, response-safe por contrato) puede
     * ejecutarse entre frames de un trial response-sensitive. Los componentes
     * sin contrato explícito reportan false — su preparación sigue el camino
     * pesado (SAFE-only).
     */
    getResourceReadinessState(config?: any) {
      if (destroyed) {
        return {
          resourceReady: false,
          gpuResourceReady: false,
          runtimeMaterializationCostEstimateMs: null as number | null,
        };
      }
      return typeof instance.getResourceReadinessState === "function"
        ? instance.getResourceReadinessState(config)
        : {
            resourceReady: false,
            gpuResourceReady: false,
            runtimeMaterializationCostEstimateMs: null as number | null,
          };
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      instance.destroy?.();
      hooks?.onDestroy?.();
    },
  };
}
