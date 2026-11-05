import { onRequest } from "firebase-functions/v2/https";
import { app } from "../../app.js";
import { requireAuth } from "../../utils/auth.js";
import { getOwnedExperiment, sendExperimentAccessError } from "../access.js";
import { validateSettingsSections } from "./model.js";

export const getExperimentFunctionalSettings = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST")
      return res.status(405).json({ success: false, message: "Use POST" });
    const uid = await requireAuth(req, res);
    if (!uid) return;
    try {
      const experimentID = req.body?.experimentID;
      const { data } = await getOwnedExperiment(experimentID, uid);
      let settings;
      try {
        settings = validateSettingsSections(data);
      } catch {
        return res
          .status(422)
          .json({
            success: false,
            code: "SETTINGS_REVIEW_REQUIRED",
            message:
              "Remote settings are incomplete or invalid. Review and save the local configuration.",
          });
      }
      const projectId = app.options.projectId || process.env.GCLOUD_PROJECT;
      if (!projectId)
        return res
          .status(503)
          .json({
            success: false,
            code: "BACKEND_UNAVAILABLE",
            message: "Backend project identity unavailable",
          });
      return res
        .status(200)
        .json({
          success: true,
          experimentID,
          projectId,
          verifiedOwnerUid: uid,
          settings,
        });
    } catch (error) {
      if (sendExperimentAccessError(res, error)) return;
      console.error("Error reading experiment settings:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Could not recover experiment settings",
        });
    }
  },
);
