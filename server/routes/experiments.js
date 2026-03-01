/**
 * @fileoverview Manages experiment routes (CRUD, publishing, execution).
 * Handles creation, reading, updating, deleting, and publishing operations
 * for jsPsych experiments, as well as HTML generation for local execution.
 * @module routes/experiments
 */

import { Router } from "express";
import path from "path";
import fs from "fs";
import { __dirname } from "../utils/paths.js";
import { v4 as uuidv4 } from "uuid";
import { db, ensureDbData, userDataRoot } from "../utils/db.js";
import { ensureTemplate } from "../utils/templates.js";
import { getPluginScriptsFromTrials } from "../utils/plugin-scripts.js";
import * as cheerio from "cheerio";

const router = Router();

// Directorios para archivos HTML de experimentos y previews
const experimentsHtmlDir = path.join(userDataRoot, "experiments_html");
const trialsPreviewsHtmlDir = path.join(userDataRoot, "trials_previews_html");
if (!fs.existsSync(experimentsHtmlDir))
  fs.mkdirSync(experimentsHtmlDir, { recursive: true });
if (!fs.existsSync(trialsPreviewsHtmlDir))
  fs.mkdirSync(trialsPreviewsHtmlDir, { recursive: true });

/**
 * Gets all experiments sorted by creation date (newest first).
 * @route GET /api/load-experiments
 * @returns {Object} 200 - List of experiments
 * @returns {Object[]} 200.experiments - Array of experiments
 * @returns {string} 200.experiments[].experimentID - Unique experiment ID
 * @returns {string} 200.experiments[].name - Experiment name
 * @returns {string} 200.experiments[].description - Optional description
 * @returns {string} 200.experiments[].createdAt - ISO creation date
 * @returns {string} 200.experiments[].updatedAt - Last update date
 * @returns {string} 200.experiments[].storage - Storage provider (googledrive|dropbox)
 * @returns {Object} 500 - Server error
 */
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

/**
 * Gets a specific experiment by its ID.
 * @route GET /api/experiment/:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @returns {Object} 200 - Experiment found
 * @returns {Object} 200.experiment - Experiment data
 * @returns {Object} 404 - Experiment not found
 * @returns {Object} 500 - Server error
 */
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

/**
 * Creates a new experiment.
 * @route POST /api/create-experiment
 * @param {Object} req.body - Experiment data
 * @param {string} req.body.name - Experiment name (required)
 * @param {string} [req.body.description] - Experiment description
 * @param {string} [req.body.author] - Experiment author
 * @param {string} [req.body.uid] - User ID
 * @param {string} [req.body.storage="googledrive"] - Storage provider
 * @returns {Object} 200 - Experiment successfully created
 * @returns {boolean} 200.success - Indicates success
 * @returns {Object} 200.experiment - Created experiment data
 * @returns {string} 200.experiment.experimentID - Generated UUID
 * @returns {Object} 400 - Experiment name is missing
 * @returns {Object} 500 - Server error
 */
router.post("/api/create-experiment", async (req, res) => {
  try {
    const { name, description, author, uid, storage } = req.body;
    if (!name)
      return res.status(400).json({ success: false, error: "Name required" });

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

/**
 * Deletes an experiment and all its related data.
 * Deletes: experiment, trials, configs, results, HTML files, and multimedia.
 * Optionally calls Firebase to remove from storage and GitHub.
 * @route DELETE /api/delete-experiment/:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @param {Object} req.body - Additional data
 * @param {string} [req.body.uid] - User ID to delete in Firebase
 * @returns {Object} 200 - Experiment successfully deleted
 * @returns {boolean} 200.success - Indicates success
 * @returns {Object} 500 - Server error
 */
router.delete("/api/delete-experiment/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const { uid } = req.body; // storage ya no se recibe del body

    await db.read();
    ensureDbData();
    // Obtener storage desde la base de datos
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID,
    );
    const storage = experiment?.storage;

    const experimentIndex = db.data.experiments.findIndex(
      (e) => e.experimentID === experimentID,
    );
    if (experimentIndex !== -1) {
      db.data.experiments.splice(experimentIndex, 1);
    }

    // Eliminar trials relacionados
    db.data.trials = db.data.trials.filter(
      (t) => t.experimentID !== experimentID,
    );

    // Eliminar configs relacionados
    db.data.configs = db.data.configs.filter(
      (c) => c.experimentID !== experimentID,
    );

    // Eliminar session results relacionados
    db.data.sessionResults = db.data.sessionResults.filter(
      (s) => s.experimentID !== experimentID,
    );

    await db.write();

    // Borrar archivos HTML usando el nombre del experimento
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

    // Borrar todos los archivos subidos del experimento
    let experimentName = experimentID;
    if (experiment && experiment.name) {
      experimentName = experiment.name;
    }
    const experimentUploadsDir = path.join(userDataRoot, experimentName);
    if (fs.existsSync(experimentUploadsDir)) {
      fs.rmSync(experimentUploadsDir, { recursive: true, force: true });
    }

    // Llamar a Firebase para eliminar experimento (storage + GitHub repo)
    if (uid) {
      try {
        // Sanitizar nombre del repositorio igual que en publish
        const sanitizedRepoName = experiment?.name
          ? experiment.name
              .replace(/\s+/g, "-") // Espacios a guiones
              .replace(/[^a-zA-Z0-9-_]/g, "") // Solo alfanuméricos, guiones y guión bajo
              .toLowerCase()
          : experimentID;

        const firebaseUrl = `${process.env.FIREBASE_URL}/apiDeleteExperiment`;

        const firebaseResponse = await fetch(firebaseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            experimentID: experimentID,
            uid: uid,
            repoName: sanitizedRepoName,
          }),
        });

        const firebaseData = await firebaseResponse.json();

        if (firebaseData.success) {
          console.log("Firebase experiment deleted successfully");
          if (firebaseData.folderDeleted) {
            console.log("Storage folder deleted");
          }
          if (firebaseData.repoDeleted) {
            console.log("GitHub repository deleted");
          }
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

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.use((req, res, next) => {
  // Match paths like /img/filename OR /:anything/img/filename
  const match = req.path.match(/^(?:\/[^/]+)?\/(img|aud|vid|others)\/(.+)$/);
  if (match) {
    const [, type, encodedFilename] = match;
    // Decode the filename to handle spaces and special characters
    const filename = decodeURIComponent(encodedFilename);
    // Search across all experiment folders
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
});

/**
 * Generates and updates the experiment HTML with the generated jsPsych code.
 * Creates or updates the HTML file based on the template.
 * @route POST /api/run-experiment/:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @param {Object} req.body - Generated code
 * @param {string} req.body.generatedCode - Generated jsPsych JavaScript code
 * @returns {Object} 200 - Experiment successfully compiled
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.message - Confirmation message
 * @returns {string} 200.experimentUrl - Local experiment URL
 * @returns {Object} 400 - Missing generated code
 * @returns {Object} 404 - Experiment not found
 * @returns {Object} 500 - Server error
 */
router.post("/api/run-experiment/:experimentID", async (req, res) => {
  try {
    const { generatedCode, canvasStyles: canvasStylesFromBody } = req.body;
    const experimentID = req.params.experimentID;

    // Obtener el nombre del experimento
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID,
    );
    if (!experiment || !experiment.name) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }
    const experimentName = experiment.name;

    // Read trial data for plugin detection and canvasStyles fallback
    const trialDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    // Resolve canvasStyles: use value from request body, fallback to DB
    let canvasStyles = canvasStylesFromBody;
    if (!canvasStyles && trialDoc) {
      for (const trial of trialDoc.trials || []) {
        const saved = trial.columnMapping?.__canvasStyles?.value;
        if (saved) {
          canvasStyles = saved;
          break;
        }
      }
    }

    const templatePath = ensureTemplate("experiment_template.html");
    const experimentHtmlPath = path.join(
      experimentsHtmlDir,
      `${experimentName}.html`,
    );
    // Always copy fresh template so stale HTML is never reused.
    fs.copyFileSync(templatePath, experimentHtmlPath);
    let html = fs.readFileSync(experimentHtmlPath, "utf8");
    const $ = cheerio.load(html);
    $("script#generated-script").remove();
    if (!generatedCode) {
      return res
        .status(400)
        .json({ success: false, error: "No generated code provided" });
    }

    // Inject only background color — never constrain width/height on full runs (must stay responsive)
    $("style#canvas-styles").remove();
    if (canvasStyles?.backgroundColor) {
      const bg = canvasStyles.backgroundColor;
      $("head").append(
        `<style id="canvas-styles">\n  body { background-color: ${bg}; }\n  .jspsych-display-element { background-color: ${bg}; }\n</style>`,
      );
    }

    $("body").append(
      `<script id="generated-script">\n${generatedCode}\n</script>`,
    );
    fs.writeFileSync(experimentHtmlPath, $.html());
    res.json({
      success: true,
      message: "Experiment built and ready to run",
      experimentUrl: `http://localhost:3000/${experimentName}`,
    });
  } catch (error) {
    console.error(`Error running experiment: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Serves the experiment HTML file for execution.
 * @route GET /:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @returns {File} 200 - Experiment HTML file
 * @returns {string} 404 - Experiment or HTML not found
 */
router.get("/:experimentID", async (req, res) => {
  const experimentID = req.params.experimentID;
  await db.read();
  const experiment = db.data.experiments.find(
    (e) => e.experimentID === experimentID,
  );
  if (!experiment || !experiment.name)
    return res.status(404).send("Experiment not found");
  const experimentName = experiment.name;
  const htmlPath = path.join(experimentsHtmlDir, `${experimentName}.html`);
  if (!fs.existsSync(htmlPath))
    return res.status(404).send("Experiment HTML not found");
  res.sendFile(htmlPath);
});

/**
 * Serves the preview HTML file for an individual trial.
 * @route GET /:experimentID/preview
 * @param {string} experimentID - Experiment ID (path parameter)
 * @returns {File} 200 - Preview HTML file
 * @returns {string} 404 - Experiment or preview not found
 */
router.get("/:experimentID/preview", async (req, res) => {
  const experimentID = req.params.experimentID;
  await db.read();
  const experiment = db.data.experiments.find(
    (e) => e.experimentID === experimentID,
  );
  if (!experiment || !experiment.name)
    return res.status(404).send("Experiment not found");
  const experimentName = experiment.name;
  const htmlPath = path.join(trialsPreviewsHtmlDir, `${experimentName}.html`);
  if (!fs.existsSync(htmlPath))
    return res.status(404).send("Preview HTML not found");
  res.sendFile(htmlPath);
});

/**
 * Generates the preview HTML to visualize an individual trial.
 * @route POST /api/trials-preview/:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @param {Object} req.body - Trial code
 * @param {string} req.body.generatedCode - Trial JavaScript code
 * @returns {Object} 200 - Preview successfully generated
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.experimentUrl - Preview URL
 * @returns {Object} 400 - Missing generated code
 * @returns {Object} 404 - Experiment not found
 * @returns {Object} 500 - Server error
 */
router.post("/api/trials-preview/:experimentID", async (req, res) => {
  try {
    const { generatedCode, canvasStyles: canvasStylesFromBody } = req.body;
    const experimentID = req.params.experimentID;

    // Obtener el nombre del experimento
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID,
    );
    if (!experiment || !experiment.name) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }
    const experimentName = experiment.name;

    // Read trial data for plugin detection and canvasStyles fallback
    const trialDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    // Resolve canvasStyles: use value from request body, fallback to DB
    let canvasStyles = canvasStylesFromBody;
    if (!canvasStyles && trialDoc) {
      for (const trial of trialDoc.trials || []) {
        const saved = trial.columnMapping?.__canvasStyles?.value;
        if (saved) {
          canvasStyles = saved;
          break;
        }
      }
    }

    const templatePath = ensureTemplate("trials_preview_template.html");
    const previewHtmlPath = path.join(
      trialsPreviewsHtmlDir,
      `${experimentName}.html`,
    );
    // Always copy fresh template so stale HTML is never reused.
    fs.copyFileSync(templatePath, previewHtmlPath);
    let html = fs.readFileSync(previewHtmlPath, "utf8");
    const $ = cheerio.load(html);
    $("script#generated-script").remove();
    if (!generatedCode) {
      return res
        .status(400)
        .json({ success: false, error: "No generated code provided" });
    }

    // Inject only background color — sizing is handled by the iframe wrapper in the UI
    $("style#canvas-styles").remove();
    if (canvasStyles?.backgroundColor) {
      const bg = canvasStyles.backgroundColor;
      $("head").append(
        `<style id="canvas-styles">\n  body { background-color: ${bg}; }\n  .jspsych-display-element { background-color: ${bg}; }\n</style>`,
      );
    }

    $("body").append(
      `<script id="generated-script">\n${generatedCode}\n</script>`,
    );
    fs.writeFileSync(previewHtmlPath, $.html());
    res.json({
      success: true,
      message: "Experiment built and ready to run",
      experimentUrl: `http://localhost:3000/${experimentID}/preview`,
    });
  } catch (error) {
    console.error(`Error running experiment: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Publishes an experiment to GitHub Pages.
 * Converts HTML to publishable format (CDN), packages multimedia files in base64,
 * and calls the Firebase function to create/update the GitHub repository.
 * @route POST /api/publish-experiment/:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @param {Object} req.body - Publication data
 * @param {string} req.body.uid - User ID (required)
 * @param {string} [req.body.storage="googledrive"] - Storage provider
 * @returns {Object} 200 - Experiment successfully published
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.message - Confirmation message
 * @returns {string} 200.repoUrl - GitHub repository URL
 * @returns {string} 200.pagesUrl - Public experiment URL on GitHub Pages
 * @returns {Object} 400 - Missing uid or publication failed
 * @returns {Object} 404 - Experiment or HTML not found
 * @returns {Object} 500 - Server or GitHub error
 */
router.post("/api/publish-experiment/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const { uid, storage, generatedPublicCode } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: "User ID (uid) is required",
      });
    }

    if (!generatedPublicCode) {
      return res.status(400).json({
        success: false,
        error:
          "Generated public code is required. Please build the experiment first.",
      });
    }

    const normalizedStorage = storage || "googledrive";

    // Buscar el experimento
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID,
    );

    if (!experiment || !experiment.name) {
      return res.status(404).json({
        success: false,
        error: "Experiment not found",
      });
    }

    // Actualizar storage si cambió
    if (experiment.storage !== normalizedStorage) {
      experiment.storage = normalizedStorage;
      experiment.updatedAt = new Date().toISOString();
      await db.write();
      console.log(
        `Storage updated to ${normalizedStorage} for experiment ${experimentID}`,
      );
    }

    // Sanitizar nombre del repositorio (sin espacios, caracteres especiales)
    const sanitizedRepoName = experiment.name
      .replace(/\s+/g, "-") // Espacios a guiones
      .replace(/[^a-zA-Z0-9-_]/g, "") // Solo alfanuméricos, guiones y guión bajo
      .toLowerCase();

    console.log(
      `Publishing experiment: ${experiment.name} as repo: ${sanitizedRepoName}`,
    );

    // Leer el HTML del experimento existente (con código local)
    const experimentHtmlPath = path.join(
      experimentsHtmlDir,
      `${experiment.name}.html`,
    );

    if (!fs.existsSync(experimentHtmlPath)) {
      return res.status(404).json({
        success: false,
        error: "Experiment HTML not found. Please build the experiment first.",
      });
    }

    let html = fs.readFileSync(experimentHtmlPath, "utf8");
    const $ = cheerio.load(html);

    // Reemplazar el script generado con código PÚBLICO enviado desde el frontend
    console.log(
      "Replacing script with PUBLIC experiment code for publishing...",
    );
    $("script#generated-script").remove();
    if (generatedPublicCode) {
      $("body").append(
        `<script id=\"generated-script\">\n${generatedPublicCode}\n</script>`,
      );
    }

    // Replace local DynamicPlugin script with the published CDN version.
    // Resolve package.json via __dirname (works in both dev and Electron asar).
    // Falls back to hardcoded values if the source folder was excluded from the build.
    let dynamicName = "jspsych-expbuilder-plugin-dynamic";
    let dynamicVersion = "1.0.0";
    try {
      const dynamicPkgPath = path.resolve(
        __dirname,
        "../dynamicplugin/package.json",
      );
      const dynamicPkg = JSON.parse(fs.readFileSync(dynamicPkgPath, "utf8"));
      dynamicName = dynamicPkg.name;
      dynamicVersion = dynamicPkg.version;
    } catch {
      console.warn(
        "dynamicplugin/package.json not found, using hardcoded CDN fallback",
      );
    }
    const dynamicCdn = `https://unpkg.com/${dynamicName}@${dynamicVersion}/dist/index.iife.js`;

    // Swap jspsych-bundle refs for individual CDN scripts
    $('link[href*="jspsych-bundle"]').remove();
    $('script[src*="jspsych-bundle"]').remove();
    $('script[src*="webgazer"]').remove();

    // Add jspsych core from CDN
    $("head").append(
      `<link href="https://unpkg.com/jspsych@8.2.2/css/jspsych.css" rel="stylesheet" type="text/css" />`,
    );
    $("head").append(`<script src="https://unpkg.com/jspsych@8.2.2"></script>`);

    // Add DynamicPlugin from CDN
    $("head").append(`<script src="${dynamicCdn}"></script>`);

    // Add only the plugins actually used by this experiment's trials
    const trialDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );
    const { scriptUrls, styleUrls } = getPluginScriptsFromTrials(
      trialDoc?.trials ?? [],
    );
    for (const url of styleUrls) {
      $("head").append(
        `<link rel="stylesheet" href="${url}" data-dynamic-styles="true" />`,
      );
    }
    for (const url of scriptUrls) {
      $("head").append(
        `<script src="${url}" data-dynamic-plugins="true"></script>`,
      );
    }

    // Leer archivos multimedia y convertir a base64
    // Must happen BEFORE $.html() so preload plugin can be conditionally injected.
    const uploadsBase = path.join(userDataRoot, experiment.name);
    const mediaTypes = ["img", "vid", "aud"];
    let mediaFiles = [];

    for (const type of mediaTypes) {
      const typeDir = path.join(uploadsBase, type);
      if (fs.existsSync(typeDir)) {
        const files = fs.readdirSync(typeDir);
        for (const filename of files) {
          const filePath = path.join(typeDir, filename);
          try {
            const fileBuffer = fs.readFileSync(filePath);
            const base64Content = fileBuffer.toString("base64");
            mediaFiles.push({
              type,
              filename,
              content: base64Content,
            });
          } catch (err) {
            console.warn(`Error reading file ${filePath}:`, err.message);
          }
        }
      }
    }

    // If the experiment has uploaded media, inject plugin-preload from CDN.
    // The frontend generates the preload trial in the experiment code, but the
    // plugin script itself is not stored in the trials array so it must be
    // detected server-side by checking whether any media files exist.
    if (mediaFiles.length > 0) {
      const preloadVersion = "2.1.0";
      $("head").append(
        `<script src="https://unpkg.com/@jspsych/plugin-preload@${preloadVersion}" data-dynamic-plugins="true"></script>`,
      );
    }

    const htmlContent = $.html();

    try {
      const githubUrl = `${process.env.FIREBASE_URL}/publishExperiment`;

      const githubResponse = await fetch(githubUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: uid,
          repoName: sanitizedRepoName,
          htmlContent: htmlContent,
          description: `Experiment: ${experiment.name}`,
          isPrivate: false,
          mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
          experimentID: experimentID,
          storageProvider: normalizedStorage,
        }),
      });

      const githubData = await githubResponse.json();

      if (githubData.success) {
        console.log(
          "Experiment published to GitHub Pages:",
          githubData.pagesUrl,
        );
        // Persist pagesUrl in the experiment document
        if (githubData.pagesUrl) {
          experiment.pagesUrl = githubData.pagesUrl;
          experiment.updatedAt = new Date().toISOString();
          await db.write();
        }
        res.json({
          success: true,
          message: "Experiment published successfully",
          repoUrl: githubData.repoUrl,
          pagesUrl: githubData.pagesUrl,
        });
      } else {
        console.warn("Warning: GitHub publish failed:", githubData.message);
        res.status(400).json({
          success: false,
          error: githubData.message || "Failed to publish experiment",
        });
      }
    } catch (githubError) {
      console.error("Error calling GitHub publish:", githubError.message);
      res.status(500).json({
        success: false,
        error: "Error publishing to GitHub: " + githubError.message,
      });
    }
  } catch (error) {
    console.error(`Error publishing experiment: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
