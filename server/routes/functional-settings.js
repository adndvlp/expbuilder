import { Router } from "express";
import {
  withDbRead,
  withDbMutation,
} from "../modules/session-persistence/dbQueue.js";
import { resolveFirebaseFunctionsUrl } from "../utils/firebaseUrl.js";
import {
  assertSettingsRevision,
  ensureSettingsDocument,
  settingsDocument,
  readFunctionalSettings,
  requireLocalExperiment,
  settingsError,
  validateSettingsSections,
  defaultFunctionalSettings,
} from "../utils/functionalSettings.js";

const router = Router();
const respondError = (res, error) =>
  res.status(error.status || 500).json({
    success: false,
    code: error.code || "SETTINGS_UNAVAILABLE",
    message: error.status ? error.message : "Could not access local settings",
  });

router.get("/api/functional-settings/:experimentID", async (req, res) => {
  try {
    const result = await withDbRead((data) => {
      requireLocalExperiment(data, req.params.experimentID);
      return readFunctionalSettings(
        settingsDocument(data, req.params.experimentID),
      );
    });
    res.json(result);
  } catch (error) {
    respondError(res, error);
  }
});

router.put("/api/functional-settings/:experimentID", async (req, res) => {
  try {
    const { expectedRevision, settings, sessionNameConfig } = req.body;
    const sections = validateSettingsSections(settings);
    if (
      sessionNameConfig !== undefined &&
      (!Array.isArray(sessionNameConfig?.tokens) ||
        typeof sessionNameConfig.separator !== "string")
    )
      throw settingsError(
        "SESSION_NAME_INVALID",
        422,
        "Invalid session name configuration",
      );
    const result = await withDbMutation((data) => {
      requireLocalExperiment(data, req.params.experimentID);
      const existing = settingsDocument(data, req.params.experimentID);
      assertSettingsRevision(existing, expectedRevision);
      const complete =
        readFunctionalSettings(existing).settingsMigration.state === "complete";
      const doc = ensureSettingsDocument(data, req.params.experimentID);
      doc.functionalSettings = {
        schemaVersion: 1,
        revision: expectedRevision + 1,
        ...sections,
      };
      doc.settingsMigration = {
        state: "complete",
        source:
          !complete &&
          JSON.stringify(sections) ===
            JSON.stringify(
              validateSettingsSections(defaultFunctionalSettings()),
            )
            ? "reviewed_defaults"
            : "local",
      };
      if (sessionNameConfig !== undefined)
        doc.sessionNameConfig = sessionNameConfig;
      doc.updatedAt = new Date().toISOString();
      return readFunctionalSettings(doc);
    });
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error);
  }
});

router.post(
  "/api/functional-settings/:experimentID/migrate",
  async (req, res) => {
    const id = req.params.experimentID;
    const expectedRevision = req.body?.expectedRevision;
    let eligible = false;
    try {
      const authorization = req.get("authorization");
      if (!/^Bearer\s+\S+/i.test(authorization || "")) {
        throw settingsError(
          "AUTH_REQUIRED",
          401,
          "Sign in to recover your published settings",
        );
      }
      const functionsUrl = resolveFirebaseFunctionsUrl();
      const projectId =
        /^https:\/\/[a-z]+-[a-z]+\d+-([a-z0-9-]+)\.cloudfunctions\.net$/.exec(
          functionsUrl || "",
        )?.[1] || process.env.FIREBASE_PROJECT_ID;
      // FIREBASE_PROJECT_ID is authoritative for custom URLs (including emulators).
      const activeProjectId = process.env.FIREBASE_PROJECT_ID || projectId;
      if (!functionsUrl || !activeProjectId)
        throw settingsError(
          "BACKEND_UNAVAILABLE",
          503,
          "Select a backend before recovering remote settings",
        );
      await withDbRead((data) => {
        const experiment = requireLocalExperiment(data, id);
        const doc = settingsDocument(data, id);
        assertSettingsRevision(doc, expectedRevision);
        if (
          readFunctionalSettings(doc).settingsMigration.state === "complete"
        ) {
          throw settingsError(
            "SETTINGS_ALREADY_COMPLETE",
            409,
            "The local configuration is already complete",
          );
        }
        if (doc?.settingsMigration?.source === "package") {
          throw settingsError(
            "SETTINGS_REVIEW_REQUIRED",
            409,
            "Review the imported copy locally or request an updated package from its author",
          );
        }
        if (
          experiment.cloudBinding &&
          (experiment.cloudBinding.projectId !== activeProjectId ||
            experiment.cloudBinding.experimentID !== id)
        ) {
          throw settingsError(
            "CLOUD_BINDING_MISMATCH",
            409,
            "Select the original backend before recovering settings",
          );
        }
      });
      eligible = true;
      const response = await fetch(
        `${functionsUrl}/getExperimentFunctionalSettings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authorization,
          },
          body: JSON.stringify({ experimentID: id }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      let body;
      try {
        body = await response.json();
      } catch {
        throw settingsError(
          "REMOTE_SETTINGS_UNAVAILABLE",
          502,
          "The backend did not return settings. Update or deploy the settings endpoint and retry.",
        );
      }
      if (!response.ok)
        throw settingsError(
          body.code || "REMOTE_SETTINGS_UNAVAILABLE",
          response.status || 502,
          body.message || "Could not recover remote settings",
        );
      if (
        !body.success ||
        body.projectId !== activeProjectId ||
        body.experimentID !== id ||
        typeof body.verifiedOwnerUid !== "string" ||
        !body.verifiedOwnerUid.trim()
      ) {
        throw settingsError(
          "CLOUD_BINDING_MISMATCH",
          409,
          "The returned project or experiment identity could not be verified",
        );
      }
      const sections = validateSettingsSections(body.settings);
      const result = await withDbMutation((data) => {
        const experiment = requireLocalExperiment(data, id);
        const existing = settingsDocument(data, id);
        assertSettingsRevision(existing, expectedRevision);
        if (
          readFunctionalSettings(existing).settingsMigration.state ===
          "complete"
        )
          throw settingsError(
            "SETTINGS_ALREADY_COMPLETE",
            409,
            "The local configuration is already complete",
          );
        if (
          experiment.cloudBinding?.verifiedOwnerUid &&
          experiment.cloudBinding.verifiedOwnerUid !== body.verifiedOwnerUid
        ) {
          throw settingsError(
            "CLOUD_BINDING_MISMATCH",
            409,
            "The verified owner differs from the existing association",
          );
        }
        const doc = ensureSettingsDocument(data, id);
        doc.functionalSettings = {
          schemaVersion: 1,
          revision: expectedRevision + 1,
          ...sections,
        };
        doc.settingsMigration = { state: "complete", source: "remote" };
        doc.updatedAt = new Date().toISOString();
        experiment.cloudBinding = {
          projectId: activeProjectId,
          experimentID: id,
          verifiedOwnerUid: body.verifiedOwnerUid,
          verifiedAt: doc.updatedAt,
        };
        return readFunctionalSettings(doc);
      });
      res.json({ success: true, ...result });
    } catch (error) {
      if (eligible && !error.status)
        error = settingsError(
          "REMOTE_SETTINGS_UNAVAILABLE",
          503,
          "Could not reach the backend. Retry recovering your settings, or review and save them locally.",
        );
      if (eligible) {
        try {
          await withDbMutation((data) => {
            requireLocalExperiment(data, id);
            const existing = settingsDocument(data, id);
            assertSettingsRevision(existing, expectedRevision);
            if (
              readFunctionalSettings(existing).settingsMigration.state ===
              "complete"
            )
              return;
            const doc = ensureSettingsDocument(data, id);
            doc.settingsMigration = {
              state: "needs_review",
              source: doc.settingsMigration?.source || "local",
            };
          });
        } catch {
          /* Preserve a concurrent save or deletion. */
        }
      }
      respondError(res, error);
    }
  },
);

export default router;
