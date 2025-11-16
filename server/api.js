import express from "express";
import multer from "multer";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import fs from "fs";
import cors from "cors";
import { Parser } from "json2csv";
import dotenv from "dotenv";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(
  cors({
    origin: `${process.env.ORIGIN}`,
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));

const dbPath = path.join(__dirname, "database", "db.json");
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const adapter = new JSONFile(dbPath);
const db = new Low(adapter, {});

function ensureDbData() {
  db.data ||= {};
  db.data.experiments ||= [];
  db.data.trials ||= [];
  db.data.configs ||= [];
  db.data.pluginConfigs ||= [];
  db.data.sessionResults ||= [];
}
await db.read();
ensureDbData();
await db.write();

app.get("/api/load-experiments", async (req, res) => {
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

app.get("/api/experiment/:experimentID", async (req, res) => {
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

app.post("/api/create-experiment", async (req, res) => {
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

// Eliminar experimento
app.delete("/api/delete-experiment/:experimentID", async (req, res) => {
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
    const experimentUploadsDir = path.join(__dirname, experimentName);
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

// Setup static file serving
app.use(express.static(path.join(__dirname, "dist"))); // Serve dist/ at root level
app.use(express.static(path.join(__dirname))); // Serve root directory
app.use(express.static(path.join(__dirname, "plugins"))); // Serve app/ directory

// Serve experiment files dynamically
app.use((req, res, next) => {
  // Match paths like /experimentName/type/filename
  const match = req.path.match(/^\/([^\/]+)\/(img|aud|vid|others)\/(.+)$/);
  if (match) {
    const [, experimentName, type, filename] = match;
    const filePath = path.join(__dirname, experimentName, type, filename);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  next();
});

const experimentsHtmlDir = path.join(__dirname, "experiments_html");
const trialsPreviewsHtmlDir = path.join(__dirname, "trials_previews_html");
if (!fs.existsSync(experimentsHtmlDir)) fs.mkdirSync(experimentsHtmlDir);
if (!fs.existsSync(trialsPreviewsHtmlDir)) fs.mkdirSync(trialsPreviewsHtmlDir);

// Endpoint para servir el experimento en /:experimentID-experiment
app.get("/:experimentID-experiment", async (req, res) => {
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

// Endpoint para servir el preview en /:experimentID-preview
app.get("/:experimentID-preview", async (req, res) => {
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

const metadataPath = path.resolve(__dirname, "metadata");
const componentsMetadataPath = path.resolve(
  __dirname,
  "dynamicplugin",
  "components-metadata"
);

// Serve the metadata directory at `/metadata` URL path
app.use("/metadata", express.static(metadataPath));

// Serve the components metadata directory
app.use(
  "/dynamicplugin/components-metadata",
  express.static(componentsMetadataPath)
);

// Component metadata endpoint
app.get("/api/component-metadata/:componentType", (req, res) => {
  try {
    const { componentType } = req.params;
    const metadataPath = path.join(
      __dirname,
      "dynamicplugin",
      "components-metadata",
      `${componentType}-component.json`
    );

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({
        error: `Metadata not found for component: ${componentType}`,
      });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    res.json(metadata);
  } catch (error) {
    console.error("Error loading component metadata:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/plugins-list", (req, res) => {
  const metadataDir = path.join(__dirname, "metadata");
  fs.readdir(metadataDir, (err, files) => {
    if (err) return res.status(500).json({ error: "No metadata dir" });
    // Solo archivos .json
    const plugins = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
    res.json({ plugins });
  });
});

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const experimentID = req.body.experimentID || req.params.experimentID;
      const ext = path.extname(file.originalname).toLowerCase();
      let type = null;
      if (/\.(png|jpg|jpeg|gif)$/i.test(ext)) type = "img";
      else if (/\.(mp3|wav|ogg|m4a)$/i.test(ext)) type = "aud";
      else if (/\.(mp4|webm|mov|avi)$/i.test(ext)) type = "vid";

      if (!type) {
        // Rechaza el archivo si no es de los tipos permitidos
        return cb(new Error("File type not allowed"), null);
      }

      // Obtener el nombre del experimento
      let experimentName = experimentID;
      await db.read();
      const experiment = db.data.experiments.find(
        (e) => e.experimentID === experimentID
      );
      if (experiment && experiment.name) {
        experimentName = `${experiment.name}-experiment`;
      }

      const folder = path.join(__dirname, experimentName, type);
      fs.mkdirSync(folder, { recursive: true });
      cb(null, folder);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

app.post(
  "/api/upload-file/:experimentID",
  upload.single("file"),
  async (req, res) => {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const experimentID = req.params.experimentID;
    const type = path.basename(path.dirname(req.file.path));
    let experimentName = experimentID;
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    if (experiment && experiment.name) {
      experimentName = `${experiment.name}-experiment`;
    }
    res.json({
      fileUrl: `${experimentName}/${type}/${req.file.filename}`,
      folder: type,
    });
  }
);

app.post(
  "/api/upload-files-folder/:experimentID",
  upload.array("files"),
  async (req, res) => {
    const experimentID = req.params.experimentID;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    let experimentName = experimentID;
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    if (experiment && experiment.name) {
      experimentName = `${experiment.name}-experiment`;
    }
    const fileUrls = req.files.map((file) => {
      const type = path.basename(path.dirname(file.path));
      return `${experimentName}/${type}/${file.filename}`;
    });
    res.json({
      fileUrls,
      info: "Archivos subidos localmente.",
    });
  }
);

app.get("/api/list-files/:type/:experimentID", async (req, res) => {
  const { experimentID, type } = req.params;
  try {
    let files = [];
    // Buscar el nombre del experimento
    let experimentName = experimentID;
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    if (experiment && experiment.name) {
      experimentName = `${experiment.name}-experiment`;
    }
    if (type === "all") {
      const types = ["img", "aud", "vid", "others"];
      types.forEach((t) => {
        const dir = path.join(__dirname, experimentName, t);
        if (fs.existsSync(dir)) {
          const typeFiles = fs.readdirSync(dir).map((filename) => ({
            name: filename,
            url: `${experimentName}/${t}/${filename}`,
            type: t,
          }));
          files = files.concat(typeFiles);
        }
      });
    } else {
      const dir = path.join(__dirname, experimentName, type);
      if (fs.existsSync(dir)) {
        files = fs.readdirSync(dir).map((filename) => ({
          name: filename,
          url: `${experimentName}/${type}/${filename}`,
          type,
        }));
      }
    }
    res.json({ files });
  } catch (err) {
    res.status(500).json({ files: [], error: err.message });
  }
});

app.delete(
  "/api/delete-file/:type/:filename/:experimentID",
  async (req, res) => {
    const { experimentID, type, filename } = req.params;
    let experimentName = experimentID;
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    if (experiment && experiment.name) {
      experimentName = `${experiment.name}-experiment`;
    }
    const filePath = path.join(__dirname, experimentName, type, filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: "File not found" });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

app.get("/api/load-trials/:experimentID", async (req, res) => {
  try {
    await db.read();
    const trialsDoc = db.data.trials.find(
      (t) => t.experimentID === req.params.experimentID
    );
    if (!trialsDoc) return res.json({ trials: null });
    res.json({ trials: trialsDoc.data });
  } catch (error) {
    res.status(500).json({ trials: null, error: error.message });
  }
});

app.post("/api/save-trials/:experimentID", async (req, res) => {
  try {
    const trials = req.body;
    await db.read();

    const existingIndex = db.data.trials.findIndex(
      (t) => t.experimentID === req.params.experimentID
    );

    const trialsDoc = {
      experimentID: req.params.experimentID,
      data: trials,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      trialsDoc.createdAt = db.data.trials[existingIndex].createdAt;
      db.data.trials[existingIndex] = trialsDoc;
    } else {
      db.data.trials.push(trialsDoc);
    }

    await db.write();
    res.json({ success: true, trials: trialsDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/trials/:id/:experimentID", async (req, res) => {
  try {
    // Convierte el id a número para que coincida con el tipo en la base de datos
    const idToDelete = Number(req.params.id);

    await db.read();
    const trialsDoc = db.data.trials.find(
      (t) => t.experimentID === req.params.experimentID
    );

    if (!trialsDoc || !trialsDoc.data || !trialsDoc.data.trials) {
      return res
        .status(404)
        .json({ success: false, error: "Trials not found." });
    }

    // Elimina el trial del array trials
    trialsDoc.data.trials = trialsDoc.data.trials.filter(
      (trial) => trial.id !== idToDelete
    );

    trialsDoc.updatedAt = new Date().toISOString();
    await db.write();

    res.json({ success: true, trials: trialsDoc.data.trials });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Guardar un solo plugin por id
app.post("/api/save-plugin/:id", async (req, res) => {
  try {
    const index = Number(req.params.id);
    const { name, scripTag, pluginCode } = req.body;
    if (isNaN(index))
      return res.status(400).json({ success: false, error: "Index required" });

    const plugin = { name, scripTag, pluginCode, index };

    await db.read();
    let pluginConfig = db.data.pluginConfigs[0];

    if (!pluginConfig) {
      pluginConfig = { plugins: [plugin], config: {} };
      db.data.pluginConfigs.push(pluginConfig);
    } else {
      const existingPluginIndex = pluginConfig.plugins.findIndex(
        (p) => p.index === index
      );
      if (existingPluginIndex >= 0) {
        const oldPlugin = pluginConfig.plugins[existingPluginIndex];
        // Limpieza de archivos y metadata si hay cambios
        const nameChanged = oldPlugin.name !== name;
        const scripTagChanged = oldPlugin.scripTag !== scripTag;
        const codeChanged = oldPlugin.pluginCode !== pluginCode;
        if (nameChanged || scripTagChanged || codeChanged) {
          if (oldPlugin.scripTag) {
            const oldFileName = path.basename(oldPlugin.scripTag);
            const oldFilePath = path.join(__dirname, "plugins", oldFileName);
            if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
          }
          if (oldPlugin.name) {
            const oldMetadataPath = path.join(
              __dirname,
              "metadata",
              `${oldPlugin.name}.json`
            );
            if (fs.existsSync(oldMetadataPath)) fs.unlinkSync(oldMetadataPath);
          }
          if (nameChanged && name !== oldPlugin.name) {
            const newMetadataPath = path.join(
              __dirname,
              "metadata",
              `${name}.json`
            );
            if (fs.existsSync(newMetadataPath)) fs.unlinkSync(newMetadataPath);
          }
        }
        pluginConfig.plugins[existingPluginIndex] = plugin;
      } else {
        pluginConfig.plugins.push(plugin);
      }
    }
    await db.write();

    // Guardar archivo del plugin
    if (pluginCode && scripTag) {
      const pluginsDir = path.join(__dirname, "plugins");
      if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir);
      const fileName = path.basename(scripTag);
      const filePath = path.join(pluginsDir, fileName);
      fs.writeFileSync(filePath, pluginCode, "utf8");
    }

    // Eliminar metadata actual para forzar regeneración
    const metadataPathFile = path.join(__dirname, "metadata", `${name}.json`);
    if (fs.existsSync(metadataPathFile)) fs.unlinkSync(metadataPathFile);

    // Actualizar experiment_template.html y trials_preview_template.html
    await db.read();
    let plugins = [];
    const pluginConfigDoc = db.data.pluginConfigs[0];
    plugins = pluginConfigDoc?.plugins || [];
    const html1Path = path.join(
      __dirname,
      "templates",
      "experiment_template.html"
    );
    const html2Path = path.join(
      __dirname,
      "templates",
      "trials_preview_template.html"
    );
    let html1 = fs.readFileSync(html1Path, "utf8");
    let html2 = fs.readFileSync(html2Path, "utf8");
    const $1 = cheerio.load(html1);
    const $2 = cheerio.load(html2);
    $1("script[id^='plugin-script']").remove();
    $2("script[id^='plugin-script']").remove();
    plugins.forEach((p, idx) => {
      if (p.scripTag) {
        $1("body").append(
          `<script src="${p.scripTag}" id="plugin-script-${idx}"></script>`
        );
        $2("body").append(
          `<script src="${p.scripTag}" id="plugin-script-${idx}"></script>`
        );
      }
    });
    fs.writeFileSync(html1Path, $1.html(), "utf8");
    fs.writeFileSync(html2Path, $2.html(), "utf8");

    // Ejecutar extract-metadata.mjs
    let metadataStatus = "ok";
    let metadataErrorMsg = "";
    try {
      await new Promise((resolve, reject) => {
        const extractScript = spawn(
          "node",
          [path.join(__dirname, "extract-metadata.mjs")],
          {
            cwd: __dirname,
            stdio: "inherit",
          }
        );
        extractScript.on("close", (code) => {
          if (code === 0) resolve();
          else {
            metadataStatus = "error";
            metadataErrorMsg = `Extract-metadata script failed with code ${code}`;
            resolve();
          }
        });
        extractScript.on("error", (err) => {
          metadataStatus = "error";
          metadataErrorMsg = `Error running extract-metadata script: ${err.message}`;
          resolve();
        });
      });
    } catch (metadataError) {
      metadataStatus = "error";
      metadataErrorMsg = metadataError.message;
    }

    res.json({
      success: true,
      plugin,
      metadataStatus,
      metadataError: metadataErrorMsg,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/delete-plugin/:index", async (req, res) => {
  try {
    const index = Number(req.params.index);
    if (isNaN(index)) {
      return res.status(400).json({ success: false, error: "Invalid index" });
    }

    await db.read();
    const pluginConfig = db.data.pluginConfigs[0];
    if (!pluginConfig) {
      return res.status(404).json({ success: false, error: "No config doc" });
    }

    const pluginToDelete = pluginConfig.plugins.find((p) => p.index === index);
    if (!pluginToDelete) {
      return res
        .status(404)
        .json({ success: false, error: "Plugin not found" });
    }

    // Eliminar el plugin del array
    pluginConfig.plugins = pluginConfig.plugins.filter(
      (p) => p.index !== index
    );
    await db.write();

    // Eliminar archivo físico del plugin
    if (pluginToDelete.scripTag) {
      const fileName = path.basename(pluginToDelete.scripTag);
      const filePath = path.join(__dirname, "plugins", fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted plugin file: ${fileName}`);
      }
    }

    // Eliminar metadata
    if (pluginToDelete.name) {
      const metadataPath = path.join(
        __dirname,
        "metadata",
        `${pluginToDelete.name}.json`
      );
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
        console.log(`🗑️ Deleted metadata: ${pluginToDelete.name}.json`);
      }
    }

    // Solo borrar la etiqueta <script id="plugin-script-{index}">
    const htmlFiles = [
      path.join(__dirname, "templates", "experiment_template.html"),
      path.join(__dirname, "templates", "trials_preview_template.html"),
    ];
    htmlFiles.forEach((htmlPath) => {
      if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, "utf8");
        const $ = cheerio.load(html);
        $(`script#plugin-script-${index}`).remove();
        fs.writeFileSync(htmlPath, $.html(), "utf8");
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener todos los plugins custom/subidos
app.get("/api/load-plugins", async (req, res) => {
  try {
    await db.read();
    const pluginConfig = db.data.pluginConfigs[0];
    if (!pluginConfig) return res.json({ plugins: [] });
    res.json({ plugins: pluginConfig.plugins });
  } catch (error) {
    res.status(500).json({ plugins: [], error: error.message });
  }
});

app.get("/api/load-config/:experimentID", async (req, res) => {
  try {
    await db.read();
    const configDoc = db.data.configs.find(
      (c) => c.experimentID === req.params.experimentID
    );
    if (!configDoc) return res.json({ config: null, isDevMode: false });
    res.json({ config: configDoc.data, isDevMode: configDoc.isDevMode });
  } catch (error) {
    res
      .status(500)
      .json({ config: null, isDevMode: false, error: error.message });
  }
});

// API endpoint to save configuration and generated code
app.post("/api/save-config/:experimentID", async (req, res) => {
  try {
    const { config, isDevMode } = req.body;

    await db.read();
    const existingIndex = db.data.configs.findIndex(
      (c) => c.experimentID === req.params.experimentID
    );

    const configDoc = {
      experimentID: req.params.experimentID,
      data: config,
      isDevMode: isDevMode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      configDoc.createdAt = db.data.configs[existingIndex].createdAt;
      db.data.configs[existingIndex] = configDoc;
    } else {
      db.data.configs.push(configDoc);
    }

    await db.write();
    res.json({ success: true, config: configDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/run-experiment/:experimentID", async (req, res) => {
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
    const templatePath = path.join(
      __dirname,
      "templates",
      "experiment_template.html"
    );
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

function getCloudflaredPath() {
  const baseDir = path.join(__dirname, "cloudflared");
  if (os.platform() === "darwin") {
    // MacOS: selecciona el binario correcto según la arquitectura
    if (os.arch() === "arm64") {
      return path.join(baseDir, "cloudflared-darwin-arm64");
    } else {
      return path.join(baseDir, "cloudflared-darwin-amd64");
    }
  } else if (os.platform() === "win32") {
    // Windows
    return path.join(baseDir, "cloudflared-windows-amd64.exe");
  } else if (os.platform() === "linux") {
    // Linux
    return path.join(baseDir, "cloudflared-linux-amd64");
  } else {
    throw new Error("Unsupported OS for cloudflared");
  }
}

let tunnelProcess = null;

app.post("/api/create-tunnel", async (req, res) => {
  const maxAttempts = 3;
  const timeoutMs = 10000; // 10 seconds
  const urlRegex = /https?:\/\/(.*?)\.trycloudflare\.com/;
  let attempt = 0;
  let responded = false;

  async function tryCreateTunnel() {
    attempt++;
    const cloudflaredPath = getCloudflaredPath();
    tunnelProcess = spawn(cloudflaredPath, [
      "tunnel",
      "--url",
      "http://localhost:3000",
      "--no-autoupdate",
    ]);

    let tunnelUrl = null;
    let timeoutId = null;

    function cleanup() {
      if (timeoutId) clearTimeout(timeoutId);
      // No matamos el proceso aquí, solo limpiamos el timeout
    }

    function handleTunnelOutput(data) {
      if (responded) return;
      const output = data.toString();
      const match = output.match(urlRegex);
      if (match && !tunnelUrl) {
        tunnelUrl = `${match[0]}`;
        responded = true;
        cleanup();
        res.json({ success: true, url: tunnelUrl });
      }
    }

    tunnelProcess.stdout.on("data", handleTunnelOutput);
    tunnelProcess.stderr.on("data", handleTunnelOutput);

    tunnelProcess.on("error", (err) => {
      if (!responded) {
        responded = true;
        cleanup();
        res.status(500).json({ success: false, error: err.message });
      }
    });

    timeoutId = setTimeout(() => {
      if (!responded) {
        cleanup();
        if (attempt < maxAttempts) {
          // Retry
          tryCreateTunnel();
        } else {
          responded = true;
          res.status(504).json({
            success: false,
            error: `Could not obtain the tunnel URL after ${maxAttempts} attempts.`,
          });
        }
      }
    }, timeoutMs);
  }

  tryCreateTunnel();
});

app.post("/api/close-tunnel", (req, res) => {
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
    return res.json({ success: true, message: "Tunnel closed" });
  } else {
    return res
      .status(400)
      .json({ success: false, message: "No active tunnel" });
  }
});

app.post("/api/trials-preview/:experimentID", async (req, res) => {
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
    const templatePath = path.join(
      __dirname,
      "templates",
      "trials_preview_template.html"
    );
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

// Endpoint para publicar experimento en GitHub
app.post("/api/publish-experiment/:experimentID", async (req, res) => {
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
    const uploadsBase = path.join(__dirname, experimentNameUploads);
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

app.post("/api/append-result/:experimentID", async (req, res) => {
  try {
    let { sessionId } = req.body;
    if (!sessionId)
      return res
        .status(400)
        .json({ success: false, error: "sessionId required" });

    await db.read();
    // Solo crear si no existe
    let existing = db.data.sessionResults.find(
      (s) =>
        s.experimentID === req.params.experimentID && s.sessionId === sessionId
    );
    if (existing) {
      return res
        .status(409)
        .json({ success: false, error: "Session already exists" });
    }

    const created = {
      experimentID: req.params.experimentID,
      sessionId,
      createdAt: new Date().toISOString(),
      data: [],
    };
    db.data.sessionResults.push(created);
    await db.write();

    // Obtener participantNumber
    const sessions = db.data.sessionResults
      .filter((s) => s.experimentID === req.params.experimentID)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const participantNumber =
      sessions.findIndex((s) => s.sessionId === sessionId) + 1;

    res.json({ success: true, id: sessionId, participantNumber });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/append-result/:experimentID", async (req, res) => {
  try {
    let { sessionId, response } = req.body;
    if (!sessionId || !response)
      return res
        .status(400)
        .json({ success: false, error: "sessionId and response required" });

    if (typeof response === "string") response = JSON.parse(response);

    await db.read();
    // Solo añadir si existe
    let existing = db.data.sessionResults.find(
      (s) =>
        s.experimentID === req.params.experimentID && s.sessionId === sessionId
    );
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    existing.data.push(response);
    await db.write();

    // Obtener participantNumber
    const sessions = db.data.sessionResults
      .filter((s) => s.experimentID === req.params.experimentID)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const participantNumber =
      sessions.findIndex((s) => s.sessionId === sessionId) + 1;

    res.json({ success: true, id: sessionId, participantNumber });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para obtener los resultados de una sesión
app.get("/api/session-results/:experimentID", async (req, res) => {
  try {
    await db.read();
    const sessions = db.data.sessionResults
      .filter((s) => s.experimentID === req.params.experimentID)
      .map(({ data, ...session }) => session) // Excluir data
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/download-session/:sessionId/:experimentID", async (req, res) => {
  try {
    const { sessionId } = req.params;

    await db.read();
    // 1. Buscar el documento
    const doc = db.data.sessionResults.find(
      (s) =>
        s.experimentID === req.params.experimentID && s.sessionId === sessionId
    );
    if (!doc) return res.status(404).send("Session not found");

    // 2. Filtrar si es necesario
    // const filteredData = doc.data.filter((row) => row.trial_type !== "preload");
    const filteredData = doc.data;

    if (!filteredData.length)
      return res.status(400).send("No valid data to export");

    // 3. Extraer todos los campos únicos
    const allFields = Array.from(
      new Set(filteredData.flatMap((row) => Object.keys(row)))
    );

    // 4. Convertir a CSV con json2csv
    const parser = new Parser({ fields: allFields });
    const csv = parser.parse(filteredData);

    // 5. Enviar como descarga
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="session_${sessionId}.csv"`
    );
    res.status(200).send(csv);
  } catch (err) {
    console.error("Error exporting CSV:", err);
    res.status(500).send("Error generating CSV");
  }
});

app.delete(
  "/api/session-results/:sessionId/:experimentID",
  async (req, res) => {
    try {
      await db.read();
      const sessionIndex = db.data.sessionResults.findIndex(
        (s) =>
          s.experimentID === req.params.experimentID &&
          s.sessionId === req.params.sessionId
      );

      if (sessionIndex === -1) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      db.data.sessionResults.splice(sessionIndex, 1);
      await db.write();

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// Endpoint para exportar el archivo db.json
app.get("/api/export-db", (req, res) => {
  const dbFilePath = path.join(__dirname, "database", "db.json");
  if (!fs.existsSync(dbFilePath)) {
    return res.status(404).send("No database file found");
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=db.json");
  fs.createReadStream(dbFilePath).pipe(res);
});

// Endpoint para importar el archivo db.json
const importDbUpload = multer({ dest: path.join(__dirname, "database") });
app.post("/api/import-db", importDbUpload.single("dbfile"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
  }
  const uploadedPath = req.file.path;
  const targetPath = path.join(__dirname, "database", "db.json");
  try {
    fs.renameSync(uploadedPath, targetPath);
    res.json({ success: true, message: "Database imported successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Middleware to handle 404 errors
app.use((req, res) => {
  console.log(`404 Not Found: ${req.url}`);
  res.status(404).send("This page doesn't exist.");
});

// Global error handlers to prevent process exit on uncaught exceptions or unhandled rejections
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Optionally log to a file or external service, PM2
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Optionally log to a file or external service
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Experiment URL: http://localhost:${port}/experiment`);
  console.log(`API URL: http://localhost:${port}/api`);
});
