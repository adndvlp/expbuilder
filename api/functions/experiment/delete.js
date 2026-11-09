import { getDatabase } from "firebase-admin/database";
import { app, db } from "../app.js";
import writeLog from "./sessions/logging/write-log.js";
import { withExperimentMutation } from "./mutation.js";
import { deleteBoundResources } from "./bindings/delete-resources.js";

/**
 * Stream-delete a collection in page-sized chunks. Optionally drains named
 * subcollections of each doc first. Bounded memory regardless of dataset
 * size — necessary for experiments with thousands of sessions (E-6).
 *
 * @param {FirebaseFirestore.CollectionReference} colRef
 * @param {Object} [options]
 * @param {string[]} [options.deleteSubcollections] - names to drain per doc
 * @param {number}   [options.pageSize=400]
 */
async function paginatedDelete(colRef, options = {}) {
  const pageSize = options.pageSize ?? 400;
  const subcols = options.deleteSubcollections ?? [];
  const checkMutation = options.checkMutation;

  while (true) {
    if (checkMutation) await checkMutation();
    const snap = await colRef.limit(pageSize).get();
    if (snap.empty) return;

    for (const doc of snap.docs) {
      for (const sub of subcols) {
        await paginatedDelete(doc.ref.collection(sub), {
          pageSize,
          checkMutation,
        });
      }
    }

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (checkMutation) await checkMutation();
    await batch.commit();

    if (snap.size < pageSize) return;
  }
}

/**
 * Función reutilizable para eliminar experimento
 * @param {string} experimentID - ID del experimento
 * @param {string} uid - Authenticated owner
 * @returns {Promise<Object>} - Resultado de la operación
 */
export async function deleteExperiment(experimentID, uid) {
  return withExperimentMutation(
    { experimentID, uid, operation: "delete" },
    async (mutation) => {
      await writeLog(experimentID, "deleteExperiment");

      const experimentRef = mutation.ref;
      const { folderDeleted, repoDeleted } = await deleteBoundResources(
        mutation,
        uid,
      );

      // E-6: stream subcollections instead of loading every doc into memory.
      // For experiments with thousands of sessions the previous `.get()` on the
      // root collection blew through function memory. `paginatedDelete` reads
      // in pages of 500, deletes via batch, repeats until empty.
      await paginatedDelete(experimentRef.collection("session_metadata"), {
        deleteSubcollections: ["participant_files", "trials"],
        checkMutation: mutation.check,
      });
      await paginatedDelete(experimentRef.collection("sessions"), {
        deleteSubcollections: ["trials"],
        checkMutation: mutation.check,
      });

      await paginatedDelete(experimentRef.collection("destination_history"), {
        checkMutation: mutation.check,
      });
      await mutation.remove();

      // Limpiar Realtime Database — sino el trigger finalizeDisconnectedSessions
      // dispara EXPERIMENT_NOT_FOUND para cada sesión activa huérfana
      let rtdbCleared = false;
      let rtdbError = null;
      try {
        await getDatabase(app).ref(`sessions/${experimentID}`).remove();
        rtdbCleared = true;
      } catch (error) {
        rtdbError = error.message;
        console.error(`Error clearing RTDB sessions/${experimentID}:`, error);
      }

      return {
        success: true,
        message: "Experiment deleted successfully",
        experimentID: experimentID,
        rtdbCleared,
        ...(rtdbError && { rtdbWarning: rtdbError }),
        folderDeleted: folderDeleted,
        repoDeleted: repoDeleted,
      };
    },
  );
}
