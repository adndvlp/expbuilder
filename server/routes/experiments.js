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

    // Llamar a la función de Firebase para crear el experimento
    try {
      // URL del emulador local o producción según el entorno
      const firebaseUrl = `${process.env.FIREBASE_URL}/apidata`;
      // Incluir uid si está presente
      const firebaseBody = {
        action: "createExperiment",
        storage: storage,
        experimentID: experimentID,
        experimentName: name,
        ...(uid && { uid }),
        ...(description && { description }),
        ...(author && { author }),
      };

      const firebaseResponse = await fetch(firebaseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(firebaseBody),
      });

      const firebaseData = await firebaseResponse.json();

      if (!firebaseData.success) {
        console.warn(
          "Warning: Firebase experiment creation failed:",
          firebaseData.message
        );
        // No bloqueamos la respuesta, pero registramos el warning
      }
    } catch (firebaseError) {
      console.error(
        "Error calling Firebase create experiment:",
        firebaseError.message
      );
      // No bloqueamos la creación local si falla Firebase
    }

    // Llamar al endpoint de GitHub para crear el repositorio si uid está presente
    let githubRepoUrl = null;
    let githubPagesUrl = null;
    if (uid) {
      try {
        const githubUrl = `${process.env.FIREBASE_URL}/githubCreateAndPublish`;

        // Por ahora solo creamos el repo con un HTML básico
        const basicHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${name}</title>
  <meta charset="UTF-8">
</head>
<body>
  <h1>${name}</h1>
  <p>Experiment ID: ${experimentID}</p>
  <p>This experiment will be available soon.</p>
</body>
</html>`;

        const githubResponse = await fetch(githubUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uid: uid,
            repoName: `${name}-experiment`,
            htmlContent: basicHtml,
            description: description || `Experiment: ${name}`,
            isPrivate: false,
          }),
        });

        const githubData = await githubResponse.json();

        if (githubData.success) {
          githubRepoUrl = githubData.repoUrl;
          githubPagesUrl = githubData.pagesUrl;
          console.log("GitHub repository created:", githubRepoUrl);
          console.log("GitHub Pages URL:", githubPagesUrl);
        } else {
          console.warn(
            "Warning: GitHub repository creation failed:",
            githubData.message
          );
        }
      } catch (githubError) {
        console.error(
          "Error calling GitHub create repository:",
          githubError.message
        );
      }
    }

    res.json({
      success: true,
      experiment,
      ...(githubRepoUrl && { githubRepoUrl }),
      ...(githubPagesUrl && { githubPagesUrl }),
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
        `${experiment.name}-experiment.html`
      );
      if (fs.existsSync(experimentHtmlPath)) fs.unlinkSync(experimentHtmlPath);

      const previewHtmlPath = path.join(
        trialsPreviewsHtmlDir,
        `${experiment.name}-preview.html`
      );
      if (fs.existsSync(previewHtmlPath)) fs.unlinkSync(previewHtmlPath);
    }

    // Borrar todos los archivos subidos del experimento
    let experimentName = experimentID;
    if (experiment && experiment.name) {
      experimentName = `${experiment.name}-experiment`;
    }
    const experimentUploadsDir = path.join(
      userDataRoot,
      "uploads",
      experimentName
    );
    if (fs.existsSync(experimentUploadsDir)) {
      fs.rmSync(experimentUploadsDir, { recursive: true, force: true });
    }

    // Llamar a la función de Firebase para eliminar el experimento en ExpBuilder (incluyendo carpeta de Dropbox)
    try {
      // URL del emulador local o producción según el entorno
      const firebaseUrl = `${process.env.FIREBASE_URL}/apidata`;

      // Incluir uid y storage desde la base de datos
      const firebaseBody = {
        action: "deleteExperiment",
        storage: storage,
        experimentID: experimentID,
        ...(uid && { uid }),
      };

      const firebaseResponse = await fetch(firebaseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(firebaseBody),
      });

      const firebaseData = await firebaseResponse.json();

      if (!firebaseData.success) {
        console.warn(
          "Warning: Firebase experiment deletion failed:",
          firebaseData.message
        );
        // No bloqueamos la respuesta, pero registramos el warning
      } else if (firebaseData.dropboxWarning) {
        console.warn(
          "Warning: Dropbox folder deletion had issues:",
          firebaseData.dropboxWarning
        );
      }
    } catch (firebaseError) {
      console.error(
        "Error calling Firebase delete experiment:",
        firebaseError.message
      );
      // No bloqueamos la eliminación local si falla Firebase
    }

    // Llamar al endpoint de GitHub para eliminar el repositorio si uid está presente
    if (uid) {
      try {
        const githubUrl = `${process.env.FIREBASE_URL}/githubDeleteRepository`;

        const githubResponse = await fetch(githubUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uid: uid,
            repoName: `${experiment?.name}-experiment`,
          }),
        });

        const githubData = await githubResponse.json();

        if (githubData.success) {
          console.log("GitHub repository deleted successfully");
        } else {
          console.warn(
            "Warning: GitHub repository deletion failed:",
            githubData.message
          );
        }
      } catch (githubError) {
        console.error(
          "Error calling GitHub delete repository:",
          githubError.message
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.use((req, res, next) => {
  // Match paths like /uploads/experimentName/type/filename
  const match = req.path.match(
    /^\/uploads\/([^\/]+)\/(img|aud|vid|others)\/(.+)$/
  );
  if (match) {
    const [, experimentName, type, filename] = match;
    const filePath = path.join(
      userDataRoot,
      "uploads",
      experimentName,
      type,
      filename
    );
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
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
      `${experimentName}-experiment.html`
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
      experimentUrl: `http://localhost:3000/${experimentName}-experiment`,
    });
  } catch (error) {
    console.error(`Error running experiment: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:experimentID-experiment", async (req, res) => {
  const experimentID = req.params.experimentID;
  await db.read();
  const experiment = db.data.experiments.find(
    (e) => e.experimentID === experimentID
  );
  if (!experiment || !experiment.name)
    return res.status(404).send("Experiment not found");
  const experimentName = experiment.name;
  const htmlPath = path.join(
    experimentsHtmlDir,
    `${experimentName}-experiment.html`
  );
  if (!fs.existsSync(htmlPath))
    return res.status(404).send("Experiment HTML not found");
  res.sendFile(htmlPath);
});

router.get("/:experimentID-preview", async (req, res) => {
  const experimentID = req.params.experimentID;
  await db.read();
  const experiment = db.data.experiments.find(
    (e) => e.experimentID === experimentID
  );
  if (!experiment || !experiment.name)
    return res.status(404).send("Experiment not found");
  const experimentName = experiment.name;
  const htmlPath = path.join(
    trialsPreviewsHtmlDir,
    `${experimentName}-preview.html`
  );
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
      `${experimentName}-preview.html`
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
      experimentUrl: `http://localhost:3000/${experimentName}-preview`,
    });
  } catch (error) {
    console.error(`Error running experiment: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/publish-experiment/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const { uid } = req.body; // storage ya no se recibe del body

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: "User ID (uid) is required",
      });
    }

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
    const experimentNamePublish = experimentPublish.name;
    // Verificar que el HTML del experimento exista
    const experimentHtmlPath = path.join(
      experimentsHtmlDir,
      `${experimentNamePublish}-experiment.html`
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

    // Obtener storage desde la base de datos
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    const storage = experiment?.storage;

    // Usar el HTML modificado para publicar en GitHub
    const htmlContent = $.html();

    // Leer archivos multimedia y convertir a base64
    let experimentNameUploads = experimentID;
    if (experimentPublish && experimentPublish.name) {
      experimentNameUploads = `${experimentPublish.name}-experiment`;
    }
    const uploadsBase = path.join(
      userDataRoot,
      "uploads",
      experimentNameUploads
    );
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
      const githubUrl = `${process.env.FIREBASE_URL}/githubUpdateHtml`;

      const githubResponse = await fetch(githubUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: uid,
          repoName: `${experiment?.name}-experiment`,
          htmlContent: htmlContent,
          ...(storage && { storage }),
          mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
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
      console.error("Error calling GitHub update HTML:", githubError.message);
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
