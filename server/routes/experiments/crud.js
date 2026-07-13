import fs from "fs";
import path from "path";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, ensureDbData, userDataRoot } from "../../utils/db.js";
import { experimentsHtmlDir, trialsPreviewsHtmlDir } from "./paths.js";

const router = Router();

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
      name,
      description,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storage,
    };

    await db.read();
    ensureDbData();
    db.data.experiments.push(experiment);
    await db.write();

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
    const { uid } = req.body;

    await db.read();
    ensureDbData();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID,
    );

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

    await db.write();

    if (experiment && experiment.name) {
      const experimentHtmlPath = path.join(
        experimentsHtmlDir,
        `${experiment.name}.html`,
      );
      if (fs.existsSync(experimentHtmlPath)) fs.unlinkSync(experimentHtmlPath);

      const previewHtmlPath = path.join(
        trialsPreviewsHtmlDir,
        `${experiment.name}.html`,
      );
      if (fs.existsSync(previewHtmlPath)) fs.unlinkSync(previewHtmlPath);
    }

    const experimentName = experiment?.name || experimentID;
    const experimentUploadsDir = path.join(userDataRoot, experimentName);
    if (fs.existsSync(experimentUploadsDir)) {
      fs.rmSync(experimentUploadsDir, { recursive: true, force: true });
    }

    if (uid) {
      await deleteFromFirebase(experiment, experimentID, uid);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function deleteFromFirebase(experiment, experimentID, uid) {
  try {
    const sanitizedRepoName = experiment?.name
      ? experiment.name
          .replace(/\s+/g, "-")
          .replace(/[^a-zA-Z0-9-_]/g, "")
          .toLowerCase()
      : experimentID;

    const firebaseUrl = `${process.env.FIREBASE_URL}/apiDeleteExperiment`;
    const firebaseResponse = await fetch(firebaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        experimentID,
        uid,
        repoName: sanitizedRepoName,
      }),
    });

    const firebaseData = await firebaseResponse.json();

    if (firebaseData.success) {
      console.log("Firebase experiment deleted successfully");
      if (firebaseData.folderDeleted) console.log("Storage folder deleted");
      if (firebaseData.repoDeleted) console.log("GitHub repository deleted");
    } else {
      console.warn(
        "Warning: Firebase experiment deletion failed:",
        firebaseData.message,
      );
    }
  } catch (firebaseError) {
    console.error(
      "Error calling Firebase delete experiment:",
      firebaseError.message,
    );
  }
}

export function serveUploadedMedia(req, res, next) {
  const match = req.path.match(/^(?:\/[^/]+)?\/(img|aud|vid|others)\/(.+)$/);
  if (match) {
    const [, type, encodedFilename] = match;
    const filename = decodeURIComponent(encodedFilename);
    const experiments = fs.readdirSync(userDataRoot).filter((dir) => {
      const stat = fs.statSync(path.join(userDataRoot, dir));
      return (
        stat.isDirectory() &&
        dir !== "experiments_html" &&
        dir !== "trials_previews_html"
      );
    });
    for (const experimentName of experiments) {
      const filePath = path.join(userDataRoot, experimentName, type, filename);
      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }
    }
  }
  next();
}

export default router;
