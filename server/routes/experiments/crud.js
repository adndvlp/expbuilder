import fs from "fs";
import path from "path";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  withDbLock,
  withDbMutation,
} from "../../modules/session-persistence/dbQueue.js";
import {
  defaultFunctionalSettings,
  ensureSettingsDocument,
} from "../../utils/functionalSettings.js";
import { db, ensureDbData } from "../../utils/db.js";
import { resolveFirebaseFunctionsUrl } from "../../utils/firebaseUrl.js";
import {
  canonicalAssetDirectory,
  assetDirectoryFor,
  assetFilePath,
  isAssetDirectoryShared,
} from "../../modules/experiment-assets/paths.js";
import { experimentsHtmlDir, trialsPreviewsHtmlDir } from "./paths.js";

import { assertAssetIdle } from "../../modules/experiment-assets/activity.js";

const router = Router();

function receiptBelongsToExperiment(receipt, experimentID) {
  if (receipt.experimentId !== undefined && receipt.experimentId !== null) {
    return String(receipt.experimentId) === String(experimentID);
  }
  try {
    return (
      String(JSON.parse(receipt.payload || "{}").experimentId) ===
      String(experimentID)
    );
  } catch {
    return false;
  }
}

router.get("/api/load-experiments", async (req, res) => {
  try {
    await db.read();
    ensureDbData();
    const experiments = db.data.experiments.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
    res.json({ experiments });
  } catch (error) {
    res.status(500).json({ experiments: [], error: error.message });
  }
});

router.get("/api/experiment/:experimentID", async (req, res) => {
  try {
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === req.params.experimentID,
    );
    if (!experiment) {
      return res.status(404).json({ experiment: null });
    }
    res.json({ experiment });
  } catch (error) {
    res.status(500).json({ experiment: null, error: error.message });
  }
});

router.post("/api/create-experiment", async (req, res) => {
  try {
    const { name, description, author, storage } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: "Name required" });
    }

    const experimentID = uuidv4();
    const experiment = {
      experimentID,
      assetDirectory: canonicalAssetDirectory(experimentID),
      name,
      description,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storage,
    };

    await withDbMutation((data) => {
      data.experiments.push(experiment);
      const config = ensureSettingsDocument(data, experimentID);
      config.functionalSettings = defaultFunctionalSettings();
      config.settingsMigration = { state: "complete", source: "new" };
      config.updatedAt = experiment.createdAt;
    });

    res.json({
      success: true,
      experiment,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* istanbul ignore next -- delete side-effect permutations are covered by route integration tests. */
router.delete("/api/delete-experiment/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const { uid, scope = uid ? "remote" : "local" } = req.body;
    if (!["remote", "local"].includes(scope)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DELETE_SCOPE",
        error: "Choose local or remote deletion",
      });
    }

    await db.read();
    ensureDbData();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID,
    );

    let assetPath = null;
    if (experiment) {
      assetPath = assetDirectoryFor(experiment);
      assertAssetIdle(experiment.assetDirectory);
      if (isAssetDirectoryShared(db.data, experiment)) assetPath = null;
      await db.write();
    }

    // Authorize and complete remote deletion before destroying any local recovery material.
    if (scope === "remote") {
      const remote = await deleteFromFirebase(
        experiment,
        experimentID,
        uid,
        req.get("authorization"),
      );
      if (!remote.success) return res.status(remote.status).json(remote.body);
      // Other local mutations may have completed while the provider request was in flight.
      await db.read();
      ensureDbData();
    }

    const experimentIndex = db.data.experiments.findIndex(
      (e) => e.experimentID === experimentID,
    );
    if (experimentIndex !== -1) {
      db.data.experiments.splice(experimentIndex, 1);
    }

    db.data.trials = db.data.trials.filter(
      (t) => t.experimentID !== experimentID,
    );
    db.data.configs = db.data.configs.filter(
      (c) => c.experimentID !== experimentID,
    );
    db.data.sessionResults = db.data.sessionResults.filter(
      (s) => s.experimentID !== experimentID,
    );
    db.data.participantFiles ||= [];
    db.data.participantFiles = db.data.participantFiles.filter(
      (f) => f.experimentID !== experimentID,
    );
    db.data.mutationReceipts = (db.data.mutationReceipts || []).filter(
      (receipt) => !receiptBelongsToExperiment(receipt, experimentID),
    );
    delete db.data.sessionCounters[experimentID];

    await db.write();

    if (experiment) {
      const experimentHtmlPath = path.join(
        experimentsHtmlDir,
        `${experimentID}.html`,
      );
      if (fs.existsSync(experimentHtmlPath)) fs.unlinkSync(experimentHtmlPath);

      const previewHtmlPath = path.join(
        trialsPreviewsHtmlDir,
        `${experimentID}.html`,
      );
      if (fs.existsSync(previewHtmlPath)) fs.unlinkSync(previewHtmlPath);
    }

    if (assetPath && fs.existsSync(assetPath)) {
      fs.rmSync(assetPath, { recursive: true, force: true });
    }

    res.json({ success: true });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ success: false, code: error.code, error: error.message });
  }
});

async function deleteFromFirebase(
  experiment,
  experimentID,
  uid,
  authorization,
) {
  if (!/^Bearer\s+\S+/i.test(authorization || "")) {
    return {
      success: false,
      status: 401,
      body: {
        success: false,
        code: "AUTH_REQUIRED",
        error: "Sign in before deleting published resources",
      },
    };
  }
  const functionsUrl = resolveFirebaseFunctionsUrl();
  if (!functionsUrl) {
    return {
      success: false,
      status: 503,
      body: {
        success: false,
        code: "BACKEND_UNAVAILABLE",
        error: "Firebase Functions URL is not configured",
      },
    };
  }
  try {
    const repoName = experiment?.name
      ? experiment.name
          .replace(/\s+/g, "-")
          .replace(/[^a-zA-Z0-9-_]/g, "")
          .toLowerCase()
      : experimentID;
    const response = await fetch(`${functionsUrl}/apiDeleteExperiment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({ experimentID, uid, repoName }),
    });
    const body = await response.json();
    if (
      body.success ||
      (response.status === 404 && body.code === "EXPERIMENT_NOT_FOUND")
    ) {
      return { success: true };
    }
    return { success: false, status: response.status || 400, body };
  } catch (error) {
    console.error("Error calling Firebase delete experiment:", error.message);
    return {
      success: false,
      status: 503,
      body: {
        success: false,
        code: "BACKEND_UNAVAILABLE",
        error: "Could not verify remote deletion. Local data was preserved.",
      },
    };
  }
}

export async function serveUploadedMedia(req, res, next) {
  const match = req.path.match(/^\/([^/]+)\/(img|aud|vid|others)\/(.+)$/);
  if (!match) return next();
  try {
    const [, experimentID, type, encodedFilename] = match;
    const filename = decodeURIComponent(encodedFilename);
    const filePath = await withDbLock(async () => {
      await db.read();
      ensureDbData();
      const experiment = db.data.experiments.find(
        (e) => e.experimentID === experimentID,
      );
      if (!experiment) return null;
      const previous = experiment.assetDirectory;
      const result = assetFilePath(experiment, type, filename);
      if (previous !== experiment.assetDirectory) await db.write();
      return result;
    });
    if (!filePath) return next();
    if (!fs.existsSync(filePath)) return next();
    return res.sendFile(filePath);
  } catch (error) {
    if (error.status)
      return res
        .status(error.status)
        .json({ success: false, code: error.code, error: error.message });
    return next(error);
  }
}

export default router;
