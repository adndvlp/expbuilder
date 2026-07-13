import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import { Router } from "express";
import { __dirname } from "../../utils/paths.js";
import { db, userDataRoot } from "../../utils/db.js";
import { ensureTemplate } from "../../utils/templates.js";
import { getPluginScriptsFromTrials } from "../../utils/plugin-scripts.js";
import { experimentsHtmlDir } from "./paths.js";
import {
  buildOversizedMediaMessage,
  GITHUB_FILE_LIMIT_BYTES,
  isPublishableMediaFile,
} from "./media.js";

const router = Router();

function getDynamicPluginCdn() {
  let dynamicName = "jspsych-expbuilder-plugin-dynamic";
  let dynamicVersion = "1.0.2";
  try {
    const dynamicPkgPath = path.resolve(
      __dirname,
      "dynamicplugin/package.json",
    );
    const dynamicPkg = JSON.parse(fs.readFileSync(dynamicPkgPath, "utf8"));
    dynamicName = dynamicPkg.name;
    dynamicVersion = dynamicPkg.version;
  } catch {
    console.warn(
      "dynamicplugin/package.json not found, using hardcoded CDN fallback",
    );
  }
  return `https://unpkg.com/${dynamicName}@${dynamicVersion}/dist/index.iife.js`;
}

function injectPublicAssets($, experiment, experimentID) {
  $('link[href*="jspsych-bundle"]').remove();
  $('script[src*="jspsych-bundle"]').remove();
  $('script[src*="webgazer"]').remove();
  $('script[src*="dynamicplugin"]').remove();

  $("head").append(
    `<link href="https://unpkg.com/jspsych@8.2.2/css/jspsych.css" rel="stylesheet" type="text/css" />`,
  );
  $("head").append(`<script src="https://unpkg.com/jspsych@8.2.2"></script>`);
  $("head").append(`<script src="${getDynamicPluginCdn()}"></script>`);

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

}

function readPublishHtml(experiment) {
  const experimentHtmlPath = path.join(
    experimentsHtmlDir,
    `${experiment.name}.html`,
  );
  if (fs.existsSync(experimentHtmlPath)) {
    return fs.readFileSync(experimentHtmlPath, "utf8");
  }
  const templatePath = ensureTemplate("experiment_template.html");
  return fs.readFileSync(templatePath, "utf8");
}

function collectMediaFiles(experimentName) {
  const uploadsBase = path.join(userDataRoot, experimentName);
  const mediaTypes = ["img", "vid", "aud"];
  let mediaFiles = [];
  const oversizedFiles = [];

  for (const type of mediaTypes) {
    const typeDir = path.join(uploadsBase, type);
    if (fs.existsSync(typeDir)) {
      const files = fs.readdirSync(typeDir).filter(isPublishableMediaFile);
      for (const filename of files) {
        const filePath = path.join(typeDir, filename);
        try {
          const sizeBytes = fs.statSync(filePath).size;
          if (sizeBytes > GITHUB_FILE_LIMIT_BYTES) {
            oversizedFiles.push({
              type,
              filename,
              url: `${type}/${encodeURIComponent(filename)}`,
              sizeBytes,
            });
            continue;
          }

          const fileBuffer = fs.readFileSync(filePath);
          mediaFiles.push({
            type,
            filename,
            content: fileBuffer.toString("base64"),
          });
        } catch (err) {
          console.warn(`Error reading file ${filePath}:`, err.message);
        }
      }
    }
  }

  return { mediaFiles, oversizedFiles };
}

async function publishToGithub(payload) {
  const githubUrl = `${process.env.FIREBASE_URL}/publishExperiment`;
  const githubResponse = await fetch(githubUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return githubResponse.json();
}

/* istanbul ignore next -- publish filesystem/Firebase permutations are covered by route integration tests. */
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

    if (experiment.storage !== normalizedStorage) {
      experiment.storage = normalizedStorage;
      experiment.updatedAt = new Date().toISOString();
      await db.write();
      console.log(
        `Storage updated to ${normalizedStorage} for experiment ${experimentID}`,
      );
    }

    const sanitizedRepoName = experiment.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .toLowerCase();

    console.log(
      `Publishing experiment: ${experiment.name} as repo: ${sanitizedRepoName}`,
    );

    const $ = cheerio.load(readPublishHtml(experiment));
    console.log(
      "Replacing script with PUBLIC experiment code for publishing...",
    );
    $("script#generated-script").remove();
    $("body").append(
      `<script id=\"generated-script\">\n${generatedPublicCode}\n</script>`,
    );

    injectPublicAssets($, experiment, experimentID);

    const { mediaFiles, oversizedFiles } = collectMediaFiles(experiment.name);
    if (oversizedFiles.length > 0) {
      const message = buildOversizedMediaMessage(oversizedFiles);
      return res.status(413).json({
        success: false,
        code: "GITHUB_FILE_TOO_LARGE",
        message,
        error: message,
        oversizedFiles,
      });
    }

    if (mediaFiles.length > 0) {
      const preloadVersion = "2.1.0";
      $("head").append(
        `<script src="https://unpkg.com/@jspsych/plugin-preload@${preloadVersion}" data-dynamic-plugins="true"></script>`,
      );
    }

    if (experiment.appearanceSettings?.fullScreen ?? true) {
      $("head").append(
        `<script src="https://unpkg.com/@jspsych/plugin-fullscreen@2.1.0" data-dynamic-plugins="true"></script>`,
      );
    }

    const htmlContent = $.html();

    try {
      const githubData = await publishToGithub({
        uid,
        repoName: sanitizedRepoName,
        htmlContent,
        description: `Experiment: ${experiment.name}`,
        isPrivate: false,
        mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
        experimentID,
        storageProvider: normalizedStorage,
      });

      if (githubData.success) {
        console.log(
          "Experiment published to GitHub Pages:",
          githubData.pagesUrl,
        );
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
