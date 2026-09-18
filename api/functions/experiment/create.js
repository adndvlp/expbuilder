import { FieldValue } from "firebase-admin/firestore";
import { db } from "../app.js";
import writeLog from "./sessions/logging/write-log.js";
import { createFolder } from "./sessions/services/folder.js";
import { getValidToken } from "../oauth/index.js";

/**
 * Función reutilizable para crear experimento
 * @param {string} experimentID - ID del experimento
 * @param {string} experimentName - Nombre del experimento
 * @param {string} uid - ID del usuario (opcional)
 * @param {string} storageProvider - Proveedor de almacenamiento ('dropbox' o 'googledrive')
 * @returns {Promise<Object>} - Resultado de la operación
 */
export async function createExperiment(
  experimentID,
  experimentName,
  uid,
  storageProvider = "googledrive",
  overrides = {},
) {
  await writeLog(experimentID, "createExperiment");

  const folderPath = `/ExpBuilder/${experimentName}`;

  let folderCreated = false;
  let folderId = null;
  let uploadLink = null; // Para OSF

  if (uid) {
    // All-or-nothing: the experiment document is only created after the
    // per-experiment storage folder exists. If the token is missing or the
    // folder cannot be created, creation fails (publish surfaces the error)
    // instead of leaving an experiment whose data has no folder to go to.
    try {
      const tokenResult = await getValidToken(storageProvider, uid);

      if (!tokenResult.success) {
        return {
          success: false,
          storageError: `Token error: ${tokenResult.error}`,
        };
      }

      // Para OSF, necesitamos el projectId del usuario
      let projectPath = folderPath;
      if (storageProvider === "osf") {
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        projectPath = userData?.osfProjectId || folderPath;
      }

      const folderResult = await createFolder(
        storageProvider,
        tokenResult.access_token,
        projectPath,
        experimentName, // componentName para OSF
      );

      if (!folderResult.success) {
        return {
          success: false,
          storageError: folderResult.errorText,
        };
      }

      folderCreated = true;
      folderId = folderResult.folderId || folderResult.componentId; // Google Drive o OSF
      uploadLink = folderResult.uploadLink; // Solo para OSF
    } catch (error) {
      return {
        success: false,
        storageError: error.message,
      };
    }
  }

  // Configurar campos específicos del proveedor
  const providerFields = {};
  if (storageProvider === "googledrive") {
    providerFields.driveFolderPath = folderPath;
    providerFields.driveFolderId = folderId;
  } else if (storageProvider === "dropbox") {
    providerFields.dropboxFolder = folderPath;
  } else if (storageProvider === "osf") {
    providerFields.osfComponentId = folderId;
    providerFields.osfUploadLink = uploadLink;
  }

  // E-3: defaults are overridable per-call. Counters (`sessions`,
  // `currentCondition`), the `id`/`owner`/`createdAt` fields, and the
  // resolved storageProvider+providerFields are locked — callers can't fake
  // them through `overrides`.
  const defaults = {
    active: true,
    limitSessions: false,
    maxSessions: 1,
    useValidation: true,
    allowJSON: true,
    allowCSV: true,
    requiredFields: ["trial_type"],
    activeConditionAssignment: true,
    nConditions: 1,
  };
  const lockedFields = new Set([
    "id",
    "owner",
    "sessions",
    "currentCondition",
    "createdAt",
    "storageProvider",
    "title",
    "driveFolderPath",
    "driveFolderId",
    "dropboxFolder",
    "osfComponentId",
    "osfUploadLink",
  ]);
  const safeOverrides = Object.fromEntries(
    Object.entries(overrides || {}).filter(([k]) => !lockedFields.has(k)),
  );

  // E-2: use create() (not set) so a re-invocation can't reset counters like
  // `sessions` or `currentCondition` on an existing doc.
  const experimentRef = db.collection("experiments").doc(experimentID);
  try {
    await experimentRef.create({
      ...defaults,
      ...safeOverrides,
      title: experimentName,
      ...providerFields,
      storageProvider: storageProvider,
      sessions: 0,
      currentCondition: 0,
      id: experimentID,
      createdAt: FieldValue.serverTimestamp(),
      ...(uid && { owner: uid }),
    });
  } catch (err) {
    if (err?.code === 6 || /ALREADY_EXISTS/i.test(err?.message || "")) {
      throw new Error("EXPERIMENT_ALREADY_EXISTS");
    }
    throw err;
  }

  return {
    success: true,
    message: "Experiment created successfully",
    experimentID: experimentID,
    folderPath: folderPath,
    ...(folderId && { folderId }),
    folderCreated: folderCreated,
  };
}
