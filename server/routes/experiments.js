import { Router } from "express";
import path from "path";
import fs from "fs";
import { __dirname } from "../utils/paths.js";
import { v4 as uuidv4 } from "uuid";
import { db, ensureDbData, userDataRoot } from "../utils/db.js";
import { ensureTemplate } from "../utils/templates.js";
import * as cheerio from "cheerio";

const router = Router();

const experimentsHtmlDir = path.join(userDataRoot, "experiments_html");
const trialsPreviewsHtmlDir = path.join(userDataRoot, "trials_previews_html");
if (!fs.existsSync(experimentsHtmlDir))
  fs.mkdirSync(experimentsHtmlDir, { recursive: true });
if (!fs.existsSync(trialsPreviewsHtmlDir))
  fs.mkdirSync(trialsPreviewsHtmlDir, { recursive: true });

router.get("/api/load-experiments", async (req, res) => {
  try {
    await db.read();
    ensureDbData();
    const experiments = db.data.experiments.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
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
      (e) => e.experimentID === req.params.experimentID
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

router.delete("/api/delete-experiment/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const { uid } = req.body; // storage ya no se recibe del body

    await db.read();
    ensureDbData();
    // Obtener storage desde la base de datos
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    const storage = experiment?.storage;

    const experimentIndex = db.data.experiments.findIndex(
      (e) => e.experimentID === experimentID
    );
    if (experimentIndex !== -1) {
      db.data.experiments.splice(experimentIndex, 1);
    }

    // Eliminar trials relacionados
    db.data.trials = db.data.trials.filter(
      (t) => t.experimentID !== experimentID
    );

    // Eliminar configs relacionados
    db.data.configs = db.data.configs.filter(
      (c) => c.experimentID !== experimentID
    );

    // Eliminar session results relacionados
    db.data.sessionResults = db.data.sessionResults.filter(
      (s) => s.experimentID !== experimentID
    );

    await db.write();

    // Borrar archivos HTML usando el nombre del experimento
    if (experiment && experiment.name) {
      const experimentHtmlPath = path.join(
        experimentsHtmlDir,
        `${experiment.name}.html`
      );
      if (fs.existsSync(experimentHtmlPath)) fs.unlinkSync(experimentHtmlPath);

      const previewHtmlPath = path.join(
        trialsPreviewsHtmlDir,
        `${experiment.name}.html`
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
        const firebaseUrl = `${process.env.FIREBASE_URL}/apiDeleteExperiment`;

        const firebaseResponse = await fetch(firebaseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            experimentID: experimentID,
            uid: uid,
            repoName: experiment?.name || experimentID,
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
            firebaseData.message
          );
        }
      } catch (firebaseError) {
        console.error(
          "Error calling Firebase delete experiment:",
          firebaseError.message
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
    const [, type, filename] = match;
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

router.post("/api/run-experiment/:experimentID", async (req, res) => {
  try {
    const { generatedCode } = req.body;
    const experimentID = req.params.experimentID;

    // Obtener el nombre del experimento
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    if (!experiment || !experiment.name) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }
    const experimentName = experiment.name;
    // Ruta de template y destino
    const templatePath = ensureTemplate("experiment_template.html");
    const experimentHtmlPath = path.join(
      experimentsHtmlDir,
      `${experimentName}.html`
    );
    // Copia el template si no existe
    if (!fs.existsSync(experimentHtmlPath)) {
      fs.copyFileSync(templatePath, experimentHtmlPath);
    }
    let html = fs.readFileSync(experimentHtmlPath, "utf8");
    const $ = cheerio.load(html);
    $("script#generated-script").remove();
    if (!generatedCode) {
      return res
        .status(400)
        .json({ success: false, error: "No generated code provided" });
    }
    $("body").append(
      `<script id="generated-script">\n${generatedCode}\n</script>`
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

router.get("/:experimentID", async (req, res) => {
  const experimentID = req.params.experimentID;
  await db.read();
  const experiment = db.data.experiments.find(
    (e) => e.experimentID === experimentID
  );
  if (!experiment || !experiment.name)
    return res.status(404).send("Experiment not found");
  const experimentName = experiment.name;
  const htmlPath = path.join(experimentsHtmlDir, `${experimentName}.html`);
  if (!fs.existsSync(htmlPath))
    return res.status(404).send("Experiment HTML not found");
  res.sendFile(htmlPath);
});

router.get("/:experimentID/preview", async (req, res) => {
  const experimentID = req.params.experimentID;
  await db.read();
  const experiment = db.data.experiments.find(
    (e) => e.experimentID === experimentID
  );
  if (!experiment || !experiment.name)
    return res.status(404).send("Experiment not found");
  const experimentName = experiment.name;
  const htmlPath = path.join(trialsPreviewsHtmlDir, `${experimentName}.html`);
  if (!fs.existsSync(htmlPath))
    return res.status(404).send("Preview HTML not found");
  res.sendFile(htmlPath);
});

router.post("/api/trials-preview/:experimentID", async (req, res) => {
  try {
    const { generatedCode } = req.body;
    const experimentID = req.params.experimentID;

    // Obtener el nombre del experimento
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    if (!experiment || !experiment.name) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }
    const experimentName = experiment.name;
    const templatePath = ensureTemplate("trials_preview_template.html");
    const previewHtmlPath = path.join(
      trialsPreviewsHtmlDir,
      `${experimentName}.html`
    );
    if (!fs.existsSync(previewHtmlPath)) {
      fs.copyFileSync(templatePath, previewHtmlPath);
    }
    let html = fs.readFileSync(previewHtmlPath, "utf8");
    const $ = cheerio.load(html);
    $("script#generated-script").remove();
    if (!generatedCode) {
      return res
        .status(400)
        .json({ success: false, error: "No generated code provided" });
    }
    $("body").append(
      `<script id="generated-script">\n${generatedCode}\n</script>`
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

router.post("/api/publish-experiment/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const { uid, storage } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: "User ID (uid) is required",
      });
    }

    const normalizedStorage = storage || "googledrive";

    // Buscar el nombre del experimento
    await db.read();
    const experimentPublish = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    if (!experimentPublish || !experimentPublish.name) {
      return res.status(404).json({
        success: false,
        error: "Experiment not found",
      });
    }

    // Actualizar storage si se proporciona y es diferente
    if (experimentPublish.storage !== normalizedStorage) {
      experimentPublish.storage = normalizedStorage;
      await db.write();
      console.log(
        `Storage updated to ${normalizedStorage} for experiment ${experimentID}`
      );
    }
    const experimentNamePublish = experimentPublish.name;
    // Verificar que el HTML del experimento exista
    const experimentHtmlPath = path.join(
      experimentsHtmlDir,
      `${experimentNamePublish}.html`
    );
    if (!fs.existsSync(experimentHtmlPath)) {
      return res.status(404).json({
        success: false,
        error: "Experiment HTML not found. Please run the experiment first.",
      });
    }
    // Leer y modificar el HTML para reemplazar el script generado
    let html = fs.readFileSync(experimentHtmlPath, "utf8");
    const $ = cheerio.load(html);

    // Obtener el código generado más reciente desde config
    await db.read();
    const configDoc = db.data.configs.find(
      (c) => c.experimentID === experimentID
    );
    const generatedCode = configDoc?.data?.generatedCode || "";

    // Reemplazar el script generado
    $("script#generated-script").remove();
    if (generatedCode) {
      $("body").append(
        `<script id=\"generated-script\">\n${generatedCode}\n</script>`
      );
    }

    // Obtener storage actualizado desde la base de datos
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    const finalStorage = experiment?.storage || "googledrive";

    // Reemplazar rutas locales por rutas CDN para publicación
    $("link[href*='jspsych-bundle']").attr(
      "href",
      "https://adndvlp.github.io/jspsych-cdn-for-expbuilder/index.css"
    );
    $("script[src*='jspsych-bundle']").attr(
      "src",
      "https://adndvlp.github.io/jspsych-cdn-for-expbuilder/index.js"
    );

    // Usar el HTML modificado para publicar en GitHub
    const htmlContent = $.html();

    // Leer archivos multimedia y convertir a base64
    let experimentNameUploads = experimentID;
    if (experimentPublish && experimentPublish.name) {
      experimentNameUploads = experimentPublish.name;
    }
    const uploadsBase = path.join(userDataRoot, experimentNameUploads);
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

    try {
      const githubUrl = `${process.env.FIREBASE_URL}/publishExperiment`;

      const githubResponse = await fetch(githubUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: uid,
          repoName: experiment?.name || experimentID,
          htmlContent: htmlContent,
          description: `Experiment: ${experiment?.name || experimentID}`,
          isPrivate: false,
          mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
          experimentID: experimentID,
          storageProvider: finalStorage,
        }),
      });

      const githubData = await githubResponse.json();

      if (githubData.success) {
        console.log(
          "Experiment published to GitHub Pages:",
          githubData.pagesUrl
        );
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
