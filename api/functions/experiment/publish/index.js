import { onRequest } from "firebase-functions/v2/https";
import { uploadFileGithub } from "../hosting/services.js";
import { requireAuth } from "../../utils/auth.js";
import { uploadMediaFiles } from "./media.js";
import { enablePages } from "./repo.js";
import { backendProjectId, bindingError } from "../bindings/common.js";
import { ensurePublicationBindings } from "../bindings/publication.js";
import { buildExperimentReservation } from "../create.js";
import { assertExperimentID, sendExperimentAccessError } from "../access.js";
import { withExperimentMutation } from "../mutation.js";
import { validateFunctionalSettings } from "../functional-settings/model.js";

/**
 * Endpoint unificado para publicar experimento en GitHub
 * Crea el repositorio si no existe, sube el contenido HTML y habilita GitHub Pages
 *
 * POST body:
 * - uid: ID del usuario
 * - repoName: Nombre del repositorio
 * - htmlContent: Contenido del archivo HTML
 * - isPrivate: Si el repositorio debe ser privado (default: false)
 * - description: Descripción del repositorio (opcional)
 * - mediaFiles: Array de archivos multimedia (opcional)
 */
export const publishExperiment = onRequest(
  { cors: true, timeoutSeconds: 300 },
  async (req, res) => {
    // T-10: CORS headers handled by onRequest({cors:true}).
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    // T-2: investigator-only endpoint — require Firebase Auth.
    const authedUid = await requireAuth(req, res);
    if (!authedUid) return;

    try {
      const {
        repoName,
        htmlContent,
        isPrivate = false,
        description = "",
        mediaFiles,
        experimentID,
        storageProvider,
      } = req.body;
      const uid = authedUid;
      // Older clients remain compatible until the versioned publication protocol.
      const functionalSettings =
        req.body.functionalSettings === undefined
          ? null
          : validateFunctionalSettings(req.body.functionalSettings);

      assertExperimentID(experimentID);
      if (
        req.body.backendProjectId &&
        req.body.backendProjectId !== backendProjectId()
      )
        throw bindingError(
          "BACKEND_CONTEXT_CHANGED",
          "The selected backend changed. Verify the publication destinations again.",
        );
      if (
        typeof repoName !== "string" ||
        !repoName ||
        typeof htmlContent !== "string" ||
        !htmlContent
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameters: repoName or htmlContent",
        });
      }

      // E-12: GitHub rejects names with non-[A-Za-z0-9._-] characters and names
      // starting with `.` or `-`. Reject early with a clear 400 instead of
      // letting GH return 422 mid-flow.
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(repoName)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid repoName: must be 1-100 chars, only letters/digits/._-, not starting with . or -",
        });
      }

      console.log(
        "Publishing experiment to GitHub for user:",
        uid,
        "repo:",
        repoName,
      );

      if (
        storageProvider &&
        !["googledrive", "dropbox", "osf"].includes(storageProvider)
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_STORAGE_PROVIDER",
          message: "Unknown storage provider",
        });
      }
      const response = await withExperimentMutation(
        {
          experimentID,
          uid,
          operation: "publish",
          initialData: buildExperimentReservation(
            experimentID,
            repoName,
            uid,
            storageProvider,
          ),
        },
        async (mutation) => {
          const reply = {
            status: (status) => ({ json: (body) => ({ status, body }) }),
          };

          const targets = await ensurePublicationBindings(
            mutation,
            uid,
            storageProvider,
            { repoName, isPrivate, description },
          );
          const {
            ownerLogin: owner,
            repoName: boundRepoName,
            branch,
          } = targets.github;
          const accessToken = targets.accessToken;
          const repoExists = targets.repoExists;

          // Subir/actualizar el archivo HTML
          console.log("Uploading/updating index.html...");
          await mutation.check();
          const uploadHtmlResult = await uploadFileGithub(
            accessToken,
            owner,
            boundRepoName,
            "index.html",
            htmlContent,
            repoExists ? "Update experiment HTML" : "Add experiment HTML file",
            branch,
          );

          if (!uploadHtmlResult.success) {
            return reply.status(400).json({
              success: false,
              message: "Error uploading HTML file",
              error: uploadHtmlResult.errorText,
            });
          }

          console.log("HTML file uploaded successfully");

          const mediaUploadResults = await uploadMediaFiles(
            accessToken,
            owner,
            boundRepoName,
            mediaFiles,
            branch,
          );

          await mutation.check();
          const pagesUrl = await enablePages(
            accessToken,
            owner,
            boundRepoName,
            branch,
          );

          // E-11: aggregate media upload outcome so the client knows which
          // resources are actually live.
          const mediaUploadStats = {
            attempted: mediaUploadResults.length,
            succeeded: mediaUploadResults.filter((r) => r.success).length,
            failed: mediaUploadResults.filter((r) => !r.success),
          };

          if (mediaUploadStats.failed.length > 0) {
            return reply.status(502).json({
              success: false,
              code: "MEDIA_UPLOAD_FAILED",
              message: "Required experiment files could not be uploaded",
              mediaUploads: mediaUploadStats,
            });
          }
          if (
            functionalSettings ||
            mutation.data.initialPublicationPending === true
          ) {
            await mutation.update({
              ...(functionalSettings && {
                publishedSettings: functionalSettings,
                batchConfig: functionalSettings.batchConfig,
                recruitmentConfig: functionalSettings.recruitmentConfig,
                captchaConfig: functionalSettings.captchaConfig,
              }),
              ...(mutation.data.initialPublicationPending === true && {
                active: true,
                initialPublicationPending: false,
              }),
            });
          }
          return reply.status(repoExists ? 200 : 201).json({
            success: true,
            message: repoExists
              ? "Experiment updated and published successfully"
              : "Experiment created and published successfully",
            repoUrl: `https://github.com/${owner}/${boundRepoName}`,
            pagesUrl: pagesUrl,
            owner: owner,
            repoName: boundRepoName,
            mediaUploads: mediaUploadStats,
            storageProvider: targets.storage.provider,
            storageBinding: targets.storage,
            githubBinding: targets.github,
          });
        },
      );
      return res.status(response.status).json(response.body);
    } catch (error) {
      if (sendExperimentAccessError(res, error)) return;
      if (error.code === "SETTINGS_INVALID")
        return res
          .status(422)
          .json({ success: false, code: error.code, message: error.message });
      console.error("Error in publishExperiment:", error);
      // T-11: don't leak internal error.message to clients.
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);
