import { db } from "../../app.js";
import { getValidToken } from "../../oauth/index.js";
import fetch from "../../utils/fetch-with-timeout.js";
import { createExperiment } from "../create.js";
import { PROVIDER_ENDPOINTS as endpoints } from "../../utils/provider-endpoints.js";

export async function createExperimentIfMissing(
  experimentID,
  repoName,
  uid,
  storageProvider,
) {
  // El experimento no existe, crearlo
  console.log("Experiment not found in Firestore. Creating...");
  const provider = storageProvider || "googledrive";

  try {
    // Si es OSF, verificar/crear proyecto
    if (provider === "osf") {
      const userDoc = await db.collection("users").doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (!userData.osfProjectId) {
          console.log("[NEW EXPERIMENT] Creating OSF project...");
          const tokenResult = await getValidToken("osf", uid);
          if (tokenResult.success) {
            const projectResponse = await fetch(
              `${endpoints.osf.apiBase}/v2/nodes/?region=us`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${tokenResult.access_token}`,
                },
                body: JSON.stringify({
                  data: {
                    type: "nodes",
                    attributes: {
                      title: "ExpBuilder",
                      category: "project",
                      description: "Experiment Builder data storage",
                      public: false,
                    },
                  },
                }),
              },
            );

            if (projectResponse.ok) {
              const projectData = await projectResponse.json();
              const osfProjectId = projectData.data.id;
              await db.collection("users").doc(uid).update({
                osfProjectId: osfProjectId,
              });
              console.log(
                "[NEW EXPERIMENT] OSF project created:",
                osfProjectId,
              );
            }
          }
        }
      }
    }

    const createResult = await createExperiment(
      experimentID,
      repoName,
      uid,
      provider,
    );
    if (!createResult.success) {
      // All-or-nothing: without a storage folder the experiment cannot
      // collect data, so publishing must fail instead of continuing.
      const setupError = new Error(
        createResult.storageError ||
          "Could not create the experiment storage folder",
      );
      setupError.code = "EXPERIMENT_STORAGE_SETUP_FAILED";
      throw setupError;
    }
    console.log("Experiment created in Firestore:", createResult);
  } catch (createError) {
    // A concurrent publish may have created the document first; the winner
    // owns the folder setup, so this race is benign.
    if (createError?.message === "EXPERIMENT_ALREADY_EXISTS") {
      console.log("Experiment was created concurrently; continuing");
      return;
    }
    throw createError;
  }
}
