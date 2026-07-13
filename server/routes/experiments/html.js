import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import { Router } from "express";
import { db } from "../../utils/db.js";
import { ensureTemplate } from "../../utils/templates.js";
import { experimentsHtmlDir, trialsPreviewsHtmlDir } from "./paths.js";

const router = Router();

function appendGeneratedScript($, generatedCode) {
  $("script#generated-script").remove();
  $("body").append(
    `<script id="generated-script">\n${generatedCode}\n</script>`,
  );
}

function appendBackgroundStyle($, canvasStyles) {
  $("style#canvas-styles").remove();
  if (canvasStyles?.backgroundColor) {
    const bg = canvasStyles.backgroundColor;
    $("head").append(
      `<style id="canvas-styles">\n  body { background-color: ${bg}; }\n  .jspsych-display-element { background-color: ${bg}; }\n</style>`,
    );
  }
}

function resolveCanvasStyles(canvasStylesFromBody, trialDoc, experiment) {
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

  if (experiment.appearanceSettings) {
    canvasStyles = {
      ...(canvasStyles || {}),
      backgroundColor:
        experiment.appearanceSettings.backgroundColor ??
        canvasStyles?.backgroundColor,
      fullScreen:
        experiment.appearanceSettings.fullScreen ?? canvasStyles?.fullScreen,
    };
  }

  return canvasStyles;
}

/* istanbul ignore next -- run HTML permutations are covered by route integration tests. */
router.post("/api/run-experiment/:experimentID", async (req, res) => {
  try {
    const { generatedCode, canvasStyles: canvasStylesFromBody } = req.body;
    const experimentID = req.params.experimentID;

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
    const trialDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );
    const canvasStyles = resolveCanvasStyles(
      canvasStylesFromBody,
      trialDoc,
      experiment,
    );

    const templatePath = ensureTemplate("experiment_template.html");
    const experimentHtmlPath = path.join(
      experimentsHtmlDir,
      `${experimentName}.html`,
    );
    fs.copyFileSync(templatePath, experimentHtmlPath);
    let html = fs.readFileSync(experimentHtmlPath, "utf8");
    const $ = cheerio.load(html);
    $("script#generated-script").remove();
    if (!generatedCode) {
      return res
        .status(400)
        .json({ success: false, error: "No generated code provided" });
    }

    appendBackgroundStyle($, canvasStyles);
    appendGeneratedScript($, generatedCode);
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

router.get("/:experimentID", async (req, res) => {
  const experimentID = req.params.experimentID;
  await db.read();
  const experiment = db.data.experiments.find(
    (e) => e.experimentID === experimentID,
  );
  if (!experiment || !experiment.name) {
    return res.status(404).send("Experiment not found");
  }
  const experimentName = experiment.name;
  const htmlPath = path.join(experimentsHtmlDir, `${experimentName}.html`);
  if (!fs.existsSync(htmlPath)) {
    return res.status(404).send("Experiment HTML not found");
  }
  res.sendFile(htmlPath);
});

router.get("/:experimentID/preview", async (req, res) => {
  const experimentID = req.params.experimentID;
  await db.read();
  const experiment = db.data.experiments.find(
    (e) => e.experimentID === experimentID,
  );
  if (!experiment || !experiment.name) {
    return res.status(404).send("Experiment not found");
  }
  const experimentName = experiment.name;
  const htmlPath = path.join(trialsPreviewsHtmlDir, `${experimentName}.html`);
  if (!fs.existsSync(htmlPath)) {
    return res.status(404).send("Preview HTML not found");
  }
  res.sendFile(htmlPath);
});

/* istanbul ignore next -- preview HTML permutations are covered by route integration tests. */
router.post("/api/trials-preview/:experimentID", async (req, res) => {
  try {
    const { generatedCode, canvasStyles: canvasStylesFromBody } = req.body;
    const experimentID = req.params.experimentID;

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
    const trialDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );
    const canvasStyles = resolveCanvasStyles(
      canvasStylesFromBody,
      trialDoc,
      { appearanceSettings: null },
    );

    const templatePath = ensureTemplate("trials_preview_template.html");
    const previewHtmlPath = path.join(
      trialsPreviewsHtmlDir,
      `${experimentName}.html`,
    );
    fs.copyFileSync(templatePath, previewHtmlPath);
    let html = fs.readFileSync(previewHtmlPath, "utf8");
    const $ = cheerio.load(html);
    $("script#generated-script").remove();
    if (!generatedCode) {
      return res
        .status(400)
        .json({ success: false, error: "No generated code provided" });
    }

    appendBackgroundStyle($, canvasStyles);
    appendGeneratedScript($, generatedCode);
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

export default router;
