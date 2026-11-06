import fs from "fs";
import path from "path";
import { Router } from "express";
import { db, userDataRoot } from "../../utils/db.js";
import { resolveFirebaseFunctionsUrl } from "../../utils/firebaseUrl.js";

import {
  assetDirectoryFor,
  assetRelativeDirectory,
  assertSafePath,
} from "../../modules/experiment-assets/paths.js";
import { assertAssetIdle } from "../../modules/experiment-assets/activity.js";

const router = Router();

async function cleanupRemoteExperiment(exp, uid, deleteRepos) {
  try {
    const sanitizedRepoName = exp?.name
      ? exp.name
          .replace(/\s+/g, "-")
          .replace(/[^a-zA-Z0-9-_]/g, "")
          .toLowerCase()
      : exp.experimentID;

    const bodyPayload = {
      experimentID: exp.experimentID,
      uid,
    };

    if (deleteRepos) {
      bodyPayload.repoName = sanitizedRepoName;
    }

    const functionsUrl = resolveFirebaseFunctionsUrl();
    if (!functionsUrl) return;
    const firebaseUrl = `${functionsUrl}/apiDeleteExperiment`;
    await fetch(firebaseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });
  } catch (err) {
    console.error(
      `Error cleaning up Firebase/Github for exp: ${exp.experimentID}`,
      err,
    );
  }
}

function clearFixedRuntimeDirs() {
  for (const d of ["experiments_html", "trials_previews_html"]) {
    const p = path.join(userDataRoot, d);
    if (fs.existsSync(p)) {
      for (const file of fs.readdirSync(p)) {
        fs.rmSync(path.join(p, file), { recursive: true, force: true });
      }
    }
  }
}

function removeRuntimeDirs(experiments) {
  const directories = new Set([path.join(userDataRoot, "uploads")]);
  for (const exp of experiments) {
    try {
      directories.add(assetDirectoryFor(exp));
    } catch {
      /* Preserve unsafe legacy paths for review. */
    }
  }
  for (const directory of directories)
    if (fs.existsSync(directory))
      fs.rmSync(directory, { recursive: true, force: true });
}

/* istanbul ignore next -- factory reset includes optional Firebase and filesystem cleanup integrations. */
router.post("/api/app/reset", async (req, res) => {
  try {
    const { uid, deleteRepos } = req.body;

    await db.read();
    const experiments = db.data.experiments || [];
    const importsDirectory = assertSafePath(".imports");
    for (const experiment of experiments) {
      let relative;
      try {
        relative = assetRelativeDirectory(experiment);
      } catch {
        continue;
      }
      assertAssetIdle(relative);
    }

    if (uid && resolveFirebaseFunctionsUrl()) {
      for (const exp of experiments) {
        await cleanupRemoteExperiment(exp, uid, deleteRepos);
      }
    }

    db.data.experiments = [];
    db.data.trials = [];
    db.data.configs = [];
    db.data.pluginConfigs = [];
    db.data.sessionResults = [];
    db.data.participantFiles = [];
    db.data.sessionCounters = {};
    db.data.mutationReceipts = [];
    db.data.importCommits = {};
    await db.write();

    clearFixedRuntimeDirs();
    removeRuntimeDirs(experiments);
    if (fs.existsSync(importsDirectory))
      fs.rmSync(importsDirectory, { recursive: true, force: true });

    res.json({
      success: true,
      message: "Todos los datos de la app han sido borrados.",
    });
  } catch (error) {
    console.error("Error in reset app:", error);
    res
      .status(error.status || 500)
      .json({ success: false, code: error.code, error: error.message });
  }
});

export default router;
