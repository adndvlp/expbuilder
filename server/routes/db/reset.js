import fs from "fs";
import path from "path";
import { Router } from "express";
import { db, userDataRoot } from "../../utils/db.js";

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

    const firebaseUrl = `${process.env.FIREBASE_URL}/apiDeleteExperiment`;
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
  const runtimeDirs = ["uploads"];
  for (const exp of experiments) {
    runtimeDirs.push(exp.name || exp.experimentID);
  }
  for (const d of runtimeDirs) {
    const p = path.join(userDataRoot, d);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
    }
  }
}

/* istanbul ignore next -- factory reset includes optional Firebase and filesystem cleanup integrations. */
router.post("/api/app/reset", async (req, res) => {
  try {
    const { uid, deleteRepos } = req.body;

    await db.read();
    const experiments = db.data.experiments || [];

    if (uid && process.env.FIREBASE_URL) {
      for (const exp of experiments) {
        await cleanupRemoteExperiment(exp, uid, deleteRepos);
      }
    }

    db.data.experiments = [];
    db.data.trials = [];
    db.data.configs = [];
    db.data.pluginConfigs = [];
    db.data.sessionResults = [];
    await db.write();

    clearFixedRuntimeDirs();
    removeRuntimeDirs(experiments);

    res.json({
      success: true,
      message: "Todos los datos de la app han sido borrados.",
    });
  } catch (error) {
    console.error("Error in reset app:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
