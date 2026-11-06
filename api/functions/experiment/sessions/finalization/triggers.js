import { db } from "../../../app.js";
import { onValueWritten } from "firebase-functions/v2/database";
import { finalizeSession } from "./finalize.js";
import { scheduleResumeExpiration } from "./resume-expiration.js";
import { lookupSessionFileUrl } from "./file-url.js";
import {
  saveAbandonedNoDataMetadata,
  saveIndexedDbSessionMetadata,
} from "./trigger-metadata.js";

/**
 * Cloud Function para finalizar sesiones desconectadas automáticamente
 * Se dispara cuando se actualiza un nodo en /sessions/{experimentID}/{sessionId}
 */
export const finalizeDisconnectedSessions = onValueWritten(
  {
    ref: "/sessions/{experimentID}/{sessionId}",
    region: "us-central1",
  },
  async (event) => {
    const beforeData = event.data.before.val();
    const afterData = event.data.after.val();

    // Si no existe el nodo después del cambio, salir
    if (!afterData) {
      return null;
    }

    // Si ya fue procesado, salir inmediatamente (esto evita reprocesar)
    if (afterData.finalizationProcessed === true) {
      return null;
    }

    const experimentID = event.params.experimentID;
    const sessionId = event.params.sessionId;
    const durable = await db.collection('experiments').doc(experimentID).collection('sessions').doc(sessionId).get();
    if (durable?.data?.()?.sessionProtocolVersion === 3) return null;
    const wasConnected = beforeData?.connected === true;
    const isNowDisconnected = afterData.connected === false;
    const wasDisconnected = beforeData?.connected === false;
    const isNowConnected = afterData.connected === true;

    // Compatibility for older publications: both modes use the same timeout.
    if (wasDisconnected && isNowConnected) {
      await event.data.after.ref.update({ state: 'resumed', resumedAt: Date.now(), resumeExpiresAt: null,
        resumeTimeoutStarted: null, resumeTimeoutTaskStatus: 'cancelled', resumeTimeoutCancelledAt: Date.now() });
      return null;
    }
    if (isNowDisconnected && wasConnected && afterData.needsFinalization !== true) {
      const state = afterData.state;
      if (state === 'disconnected' && !afterData.finished) {
        const minutes = durable?.data?.()?.configuration?.batchConfig?.resumeTimeoutMinutes ?? afterData.resumeTimeoutMinutes ?? 30;
        const disconnectedAt = Number.isFinite(afterData.disconnectedAt) ? afterData.disconnectedAt : Date.now();
        await scheduleResumeExpiration({ ref: event.data.after.ref, experimentID, sessionId, expiresAt: disconnectedAt + minutes * 60000 });
        return null;
      }
      // Si la sesión ya está completada o abandonada (IndexedDB/Drive guardó los datos directamente)
      if ((state === "completed" || state === "abandoned") && afterData.useIndexedDB !== false) {
        const fileUrl = await lookupSessionFileUrl(experimentID, sessionId);
        await saveIndexedDbSessionMetadata({
          experimentID,
          sessionId,
          state,
          afterData,
          fileUrl,
        });

        await event.data.after.ref.update({
          finalizationProcessed: true,
          processedAt: Date.now(),
        });

        return null;
      }
    }

    // CASO 3: Finalización normal
    // Solo procesar si needsFinalization está en true
    if (afterData.needsFinalization !== true) {
      return null;
    }

    // IMPORTANTE: Solo procesar si cambió de connected=true a connected=false.
    // S-16: when the session never reached connected=true (created already
    // disconnected, then later set needsFinalization), beforeData?.connected
    // is undefined. needsFinalization is an explicit client intent — honor it
    // and still finalize.
    const wasConnectedOrInitial = wasConnected || beforeData == null;
    if (!wasConnectedOrInitial || !isNowDisconnected) {
      return null;
    }

    const isAbandoned = afterData.state === "abandoned";

    try {
      // Usar la función unificada que determina el storage provider automáticamente
      const result = await finalizeSession(experimentID, sessionId);
      if (result.pending) {
        await event.data.after.ref.update({ exportStatus: result.exportStatus, exportRevision: result.revision,
          needsFinalization: false, finalizationProcessed: false });
        return null;
      }

      // Marcar como procesado en Realtime Database
      await event.data.after.ref.update({
        finalizationProcessed: true,
        processedAt: Date.now(),
        resultsSent: result.resultsSent,
      });

      console.log(`Session ${sessionId} finalized successfully`);
      return null;
    } catch (error) {
      console.error(`Error finalizing session ${sessionId}:`, error);

      // Si el error es que no hay datos (SESSION_NOT_FOUND o NO_RESULTS),
      // también marcar como procesado para evitar reintentos
      const isNoDataError =
        error.message === "SESSION_NOT_FOUND" || error.message === "NO_RESULTS";

      // Si fue abandonado sin datos, guardar metadata de todas formas
      if (isNoDataError && isAbandoned) {
        await saveAbandonedNoDataMetadata(experimentID, sessionId, afterData);
      }

      await event.data.after.ref.update({
        finalizationProcessed: true,
        finalizationError: error.message,
        processedAt: Date.now(),
        ...(isNoDataError && { noDataToFinalize: true }),
      });

      return null;
    }
  },
);
