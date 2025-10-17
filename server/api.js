// Updated api.js with improved static file serving
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import fs from "fs";
import cors from "cors";
import { Parser } from "json2csv";
import dotenv from "dotenv";
import { spawn } from "child_process"; // Para script de extract-metadata.mjs en run-experiment
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Configure CORS to allow requests from your frontend
app.use(
  cors({
    origin: `${process.env.ORIGIN}`, // Replace with your frontend URL if different
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" })); // Increased limit for larger code files

// mongoose.connect(process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  if (process.env.NODE_ENV === "production") {
    await regeneratePluginsFromDatabase();
  } else {
    console.log("🚧 Skipping plugin regeneration (not in production mode)");
  }
});

const ExperimentSchema = new mongoose.Schema(
  {
    experimentID: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
    author: { type: String },
  },
  { timestamps: true }
);

const Experiment =
  mongoose.models.Experiment || mongoose.model("Experiment", ExperimentSchema);

// Listar experimentos
app.get("/api/load-experiments", async (req, res) => {
  try {
    const experiments = await Experiment.find({}).sort({ createdAt: -1 });
    res.json({ experiments });
  } catch (error) {
    res.status(500).json({ experiments: [], error: error.message });
  }
});

// Obtener experimento por experimentID
app.get("/api/experiment/:experimentID", async (req, res) => {
  try {
    const experiment = await Experiment.findOne({
      experimentID: req.params.experimentID,
    });
    if (!experiment) {
      return res.status(404).json({ experiment: null });
    }
    res.json({ experiment });
  } catch (error) {
    res.status(500).json({ experiment: null, error: error.message });
  }
});

// Endpoint para crear experimento
app.post("/api/create-experiment", async (req, res) => {
  try {
    const { name, description, author, uid } = req.body;
    if (!name)
      return res.status(400).json({ success: false, error: "Name required" });

    const experimentID = uuidv4();
    const experiment = await Experiment.create({
      experimentID,
      name,
      description,
      author,
    });

    // Llamar a la función de Firebase para crear el experimento en DataPipe
    try {
      // URL del emulador local o producción según el entorno
      const firebaseUrl = `${process.env.FIREBASE_URL}/apicreateexperiment`; // URL de producción // Emulador local
      // Incluir uid si está presente
      const firebaseBody = {
        experimentID: experimentID,
        experimentName: name,
      };
      if (uid) {
        firebaseBody.uid = uid;
      }

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
            repoName: `experiment-${experimentID}`,
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
    const { uid } = req.body; // Obtener uid del body si está presente

    const deleted = await Experiment.findOneAndDelete({ experimentID });
    await Trials.deleteMany({ experimentID });
    await Config.deleteMany({ experimentID });
    await SessionResult.deleteMany({ experimentID });

    // Opcional: borrar archivos HTML
    const experimentHtmlPath = path.join(
      experimentsHtmlDir,
      `experiment_${experimentID}.html`
    );
    if (fs.existsSync(experimentHtmlPath)) fs.unlinkSync(experimentHtmlPath);

    const previewHtmlPath = path.join(
      trialsPreviewsHtmlDir,
      `trials_preview_${experimentID}.html`
    );
    if (fs.existsSync(previewHtmlPath)) fs.unlinkSync(previewHtmlPath);

    // Borrar todos los archivos subidos del experimento
    const experimentUploadsDir = path.join(uploadsDir, experimentID);
    if (fs.existsSync(experimentUploadsDir)) {
      fs.rmSync(experimentUploadsDir, { recursive: true, force: true });
    }

    // Llamar a la función de Firebase para eliminar el experimento en DataPipe (incluyendo carpeta de Dropbox)
    try {
      // URL del emulador local o producción según el entorno
      const firebaseUrl = `${process.env.FIREBASE_URL}/apideleteexperiment`; // URL

      // Incluir uid si está presente para eliminar también la carpeta de Dropbox
      const firebaseBody = {
        experimentID: experimentID,
      };
      if (uid) {
        firebaseBody.uid = uid;
      }

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
            repoName: `experiment-${experimentID}`,
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

const experimentsHtmlDir = path.join(__dirname, "experiments_html");
const trialsPreviewsHtmlDir = path.join(__dirname, "trials_previews_html");
if (!fs.existsSync(experimentsHtmlDir)) fs.mkdirSync(experimentsHtmlDir);
if (!fs.existsSync(trialsPreviewsHtmlDir)) fs.mkdirSync(trialsPreviewsHtmlDir);

// Modifica los endpoints para servir los archivos
app.get("/experiment/:experimentID", (req, res) => {
  const experimentHtmlPath = path.join(
    experimentsHtmlDir,
    `experiment_${req.params.experimentID}.html`
  );
  if (!fs.existsSync(experimentHtmlPath)) {
    return res.status(404).send("Experiment not found");
  }
  res.sendFile(experimentHtmlPath);
});

app.get("/trials-preview/:experimentID", (req, res) => {
  const previewHtmlPath = path.join(
    trialsPreviewsHtmlDir,
    `trials_preview_${req.params.experimentID}.html`
  );
  if (!fs.existsSync(previewHtmlPath)) {
    return res.status(404).send("Preview not found");
  }
  res.sendFile(previewHtmlPath);
});

const metadataPath = path.resolve(__dirname, "metadata");

// Serve the metadata directory at `/metadata` URL path
app.use("/metadata", express.static(metadataPath));

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

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
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

    const folder = path.join(uploadsDir, experimentID, type);
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

app.use("/uploads", express.static(uploadsDir));

app.post(
  "/api/upload-file/:experimentID",
  upload.single("file"),
  (req, res) => {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const experimentID = req.params.experimentID;
    const type = path.basename(path.dirname(req.file.path));
    res.json({
      fileUrl: `/uploads/${experimentID}/${type}/${req.file.filename}`,
      folder: type,
    });
  }
);

app.post(
  "/api/upload-files-folder/:experimentID",
  upload.array("files"),
  (req, res) => {
    const experimentID = req.params.experimentID;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    const fileUrls = req.files.map((file) => {
      const type = path.basename(path.dirname(file.path));
      return `/uploads/${experimentID}/${type}/${file.filename}`;
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
    if (type === "all") {
      const types = ["img", "aud", "vid", "others"];
      types.forEach((t) => {
        const dir = path.join(uploadsDir, experimentID, t);
        if (fs.existsSync(dir)) {
          const typeFiles = fs.readdirSync(dir).map((filename) => ({
            name: filename,
            url: `/uploads/${experimentID}/${t}/${filename}`,
            type: t,
          }));
          files = files.concat(typeFiles);
        }
      });
    } else {
      const dir = path.join(uploadsDir, experimentID, type);
      if (fs.existsSync(dir)) {
        files = fs.readdirSync(dir).map((filename) => ({
          name: filename,
          url: `/uploads/${experimentID}/${type}/${filename}`,
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
    const filePath = path.join(uploadsDir, experimentID, type, filename);
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

const ConfigSchema = new mongoose.Schema(
  {
    experimentID: { type: String, required: true },
    data: { type: Object, required: true },
    isDevMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Config = mongoose.models.Config || mongoose.model("Config", ConfigSchema);

const TrialsSchema = new mongoose.Schema(
  {
    experimentID: { type: String, required: true },
    data: { type: Object, required: true },
  },
  { timestamps: true }
);
const Trials = mongoose.models.Trials || mongoose.model("Trials", TrialsSchema);

app.get("/api/load-trials/:experimentID", async (req, res) => {
  try {
    const trialsDoc = await Trials.findOne({
      experimentID: req.params.experimentID,
    });
    if (!trialsDoc) return res.json({ trials: null });
    res.json({ trials: trialsDoc.data });
  } catch (error) {
    res.status(500).json({ trials: null, error: error.message });
  }
});

app.post("/api/save-trials/:experimentID", async (req, res) => {
  try {
    const trials = req.body;
    const updated = await Trials.findOneAndUpdate(
      { experimentID: req.params.experimentID },
      { data: trials },
      { upsert: true, new: true }
    );
    res.json({ success: true, trials: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/trials/:id/:experimentID", async (req, res) => {
  try {
    // Convierte el id a número para que coincida con el tipo en la base de datos
    const idToDelete = Number(req.params.id);

    // Elimina el trial del array trials dentro del documento
    const updated = await Trials.findOneAndUpdate(
      { experimentID: req.params.experimentID, "data.trials.id": idToDelete },
      { $pull: { "data.trials": { id: idToDelete } } },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, error: "Trial not found." });
    }

    res.json({ success: true, trials: updated.data.trials });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PluginItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    scripTag: { type: String, required: true },
    pluginCode: { type: String, required: true },
    index: { type: Number, required: true },
  },
  { _id: false }
);

const PluginConfigSchema = new mongoose.Schema({
  plugins: { type: [PluginItemSchema], default: [] }, // <- aquí va el array de plugins
  config: { type: Object, default: {} }, // otras opciones del editor/experimento
});

const PluginConfig =
  mongoose.models.PluginConfig ||
  mongoose.model("PluginConfig", PluginConfigSchema);

// Función para regenerar archivos de plugins y actualizar HTML desde la BD. Solo en entorno de producción
async function regeneratePluginsFromDatabase() {
  try {
    console.log("🔄 Regenerating plugins from database...");

    // Obtener plugins de la BD
    const pluginConfigDoc = await PluginConfig.findOne({
      experimentID: req.params.experimentID,
    });
    const plugins = pluginConfigDoc?.plugins || [];

    if (plugins.length === 0) {
      console.log("ℹ️ No plugins found in database");
      return;
    }

    // Crear directorio de plugins si no existe
    const pluginsDir = path.join(__dirname, "plugins");
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    // Crear directorio de metadata si no existe
    const metadataDir = path.join(__dirname, "metadata");
    if (!fs.existsSync(metadataDir)) {
      fs.mkdirSync(metadataDir, { recursive: true });
    }

    // Regenerar archivos de plugins
    plugins.forEach((plugin) => {
      if (plugin.pluginCode && plugin.scripTag) {
        const fileName = path.basename(plugin.scripTag);
        const filePath = path.join(pluginsDir, fileName);
        fs.writeFileSync(filePath, plugin.pluginCode, "utf8");
        console.log(`✅ Regenerated plugin file: ${fileName}`);
      }
    });

    // Actualizar experiment.html y trials_preview.html
    const htmlFiles = [
      {
        path: path.join(__dirname, "experiment.html"),
        name: "experiment.html",
      },
      {
        path: path.join(__dirname, "trials_preview.html"),
        name: "trials_preview.html",
      },
    ];

    htmlFiles.forEach(({ path: htmlPath, name }) => {
      if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, "utf8");
        const $ = cheerio.load(html);

        // Remover scripts de plugins existentes
        $("script[id^='plugin-script']").remove();

        // Agregar scripts de plugins desde la BD
        plugins.forEach((p, idx) => {
          if (p.scripTag) {
            $("body").append(
              `<script src="${p.scripTag}" id="plugin-script-${idx}"></script>`
            );
          }
        });

        fs.writeFileSync(htmlPath, $.html(), "utf8");
        console.log(`✅ Updated ${name} with ${plugins.length} plugin scripts`);
      }
    });

    // Ejecutar extract-metadata.mjs para regenerar metadata
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
          if (code === 0) {
            console.log("✅ Metadata regenerated successfully");
            resolve();
          } else {
            console.log(`⚠️ Extract-metadata script failed with code ${code}`);
            resolve(); // No rechazamos para no bloquear el inicio
          }
        });
        extractScript.on("error", (err) => {
          console.log(
            `⚠️ Error running extract-metadata script: ${err.message}`
          );
          resolve(); // No rechazamos para no bloquear el inicio
        });
      });
    } catch (metadataError) {
      console.log(`⚠️ Metadata regeneration error: ${metadataError.message}`);
    }

    console.log("🎉 Plugin regeneration completed");
  } catch (error) {
    console.error("❌ Error regenerating plugins:", error.message);
  }
}

// Guardar un solo plugin por id
app.post("/api/save-plugin/:id", async (req, res) => {
  try {
    const index = Number(req.params.id);
    const { name, scripTag, pluginCode } = req.body;
    if (isNaN(index))
      return res.status(400).json({ success: false, error: "Index required" });

    const plugin = { name, scripTag, pluginCode, index };

    let doc = await PluginConfig.findOne({});
    if (!doc) {
      doc = await PluginConfig.create({ plugins: [plugin] });
    } else {
      const existingPluginIndex = doc.plugins.findIndex(
        (p) => p.index === index
      );
      if (existingPluginIndex >= 0) {
        const oldPlugin = doc.plugins[existingPluginIndex];
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
        doc.plugins[existingPluginIndex] = plugin;
      } else {
        doc.plugins.push(plugin);
      }
    }
    await doc.save();

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

    // Actualizar experiment.html y trials_preview.html
    let plugins = [];
    const pluginConfigDoc = await PluginConfig.findOne({});
    plugins = pluginConfigDoc?.plugins || [];
    const html1Path = path.join(__dirname, "experiment.html");
    const html2Path = path.join(__dirname, "trials_preview.html");
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

    // Buscar el plugin antes de eliminarlo para obtener sus datos
    const doc = await PluginConfig.findOne({});
    if (!doc) {
      return res.status(404).json({ success: false, error: "No config doc" });
    }

    const pluginToDelete = doc.plugins.find((p) => p.index === index);
    if (!pluginToDelete) {
      return res
        .status(404)
        .json({ success: false, error: "Plugin not found" });
    }

    // Eliminar el plugin de la base de datos
    const updated = await PluginConfig.findOneAndUpdate(
      {},
      { $pull: { plugins: { index } } },
      { new: true }
    );

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
      path.join(__dirname, "experiment.html"),
      path.join(__dirname, "trials_preview.html"),
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
    const doc = await PluginConfig.findOne({});
    if (!doc) return res.json({ plugins: [] });
    res.json({ plugins: doc.plugins });
  } catch (error) {
    res.status(500).json({ plugins: [], error: error.message });
  }
});

app.get("/api/load-config/:experimentID", async (req, res) => {
  try {
    const configDoc = await Config.findOne({
      experimentID: req.params.experimentID,
    });
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
    const updated = await Config.findOneAndUpdate(
      { experimentID: req.params.experimentID },
      { data: config, isDevMode: isDevMode },
      { upsert: true, new: true }
    );
    res.json({ success: true, config: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/run-experiment/:experimentID", async (req, res) => {
  try {
    const { generatedCode } = req.body;
    const experimentID = req.params.experimentID;

    // Ruta de template y destino
    const templatePath = path.join(
      __dirname,
      "templates",
      "experiment_template.html"
    );
    const experimentHtmlPath = path.join(
      experimentsHtmlDir,
      `experiment_${experimentID}.html`
    );

    // Copia el template si no existe
    if (!fs.existsSync(experimentHtmlPath)) {
      fs.copyFileSync(templatePath, experimentHtmlPath);
    }
    let html = fs.readFileSync(experimentHtmlPath, "utf8");
    const $ = cheerio.load(html);

    // Elimina script previo: generated-script

    $("script#generated-script").remove();

    // Inserta el código generado (desde config)
    // const configDoc = await Config.findOne({});
    // if (!configDoc || !configDoc.data || !configDoc.data.generatedCode) {
    //   return res
    //     .status(400)
    //     .json({ success: false, error: "No generated code found in config" });
    // }

    // $("body").append(
    //   `<script id="generated-script">\n${configDoc.data.generatedCode}\n</script>`
    // );
    // Usa el código pasado en el body en lugar de leerlo de la BD
    if (!generatedCode) {
      return res
        .status(400)
        .json({ success: false, error: "No generated code provided" });
    }

    $("body").append(
      `<script id="generated-script">\n${generatedCode}\n</script>`
    );

    // Guarda el HTML modificado
    fs.writeFileSync(experimentHtmlPath, $.html());

    res.json({
      success: true,
      message: "Experiment built and ready to run",
      experimentUrl: `http://localhost:3000/experiment/${experimentID}`,
    });
  } catch (error) {
    console.error(`Error running experiment: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/trials-preview/:experimentID", async (req, res) => {
  try {
    const { generatedCode } = req.body;
    const experimentID = req.params.experimentID;

    const templatePath = path.join(
      __dirname,
      "templates",
      "trials_preview_template.html"
    );
    const previewHtmlPath = path.join(
      trialsPreviewsHtmlDir,
      `trials_preview_${experimentID}.html`
    );
    if (!fs.existsSync(previewHtmlPath)) {
      fs.copyFileSync(templatePath, previewHtmlPath);
    }
    let html = fs.readFileSync(previewHtmlPath, "utf8");
    const $ = cheerio.load(html);

    // Elimina scripts previos de generated-script
    $("script#generated-script").remove();

    // Usa el código pasado en el body en lugar de leerlo de la BD
    if (!generatedCode) {
      return res
        .status(400)
        .json({ success: false, error: "No generated code provided" });
    }

    $("body").append(
      `<script id="generated-script">\n${generatedCode}\n</script>`
    );

    // Guarda el HTML modificado
    fs.writeFileSync(previewHtmlPath, $.html());

    res.json({
      success: true,
      message: "Experiment built and ready to run",
      experimentUrl: `http://localhost:3000/trials_preview/${experimentID}`,
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
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: "User ID (uid) is required",
      });
    }

    // Verificar que el HTML del experimento exista
    const experimentHtmlPath = path.join(
      experimentsHtmlDir,
      `experiment_${experimentID}.html`
    );

    if (!fs.existsSync(experimentHtmlPath)) {
      return res.status(404).json({
        success: false,
        error: "Experiment HTML not found. Please run the experiment first.",
      });
    }

    // Leer el contenido del HTML
    const htmlContent = fs.readFileSync(experimentHtmlPath, "utf8");

    // Llamar al endpoint de GitHub para actualizar el HTML
    try {
      const githubUrl = `${process.env.FIREBASE_URL}/githubUpdateHtml`;

      const githubResponse = await fetch(githubUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: uid,
          repoName: `experiment-${experimentID}`,
          htmlContent: htmlContent,
          // Opcionalmente puedes agregar envContent aquí si lo necesitas
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

// Modelo para resultados individuales por participante
const SessionResultSchema = new mongoose.Schema({
  experimentID: { type: String, required: true },
  sessionId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  data: { type: Array, default: [] },
});
const SessionResult =
  mongoose.models.SessionResult ||
  mongoose.model("SessionResult", SessionResultSchema);

// Endpoint para agregar una respuesta a la sesión
// app.post("/api/append-result", async (req, res) => {
//   try {
//     let { sessionId, response } = req.body;
//     if (!sessionId || !response)
//       return res
//         .status(400)
//         .json({ success: false, error: "sessionId and response required" });

//     // Si recibes un string, parsea:
//     if (typeof response === "string") response = JSON.parse(response);

//     // Busca el documento o créalo si no existe
//     const updated = await SessionResult.findOneAndUpdate(
//       { sessionId },
//       { $push: { data: response } },
//       { upsert: true, new: true }
//     );

//     // Obtén todas las sesiones ordenadas por fecha
//     const sessions = await SessionResult.find({}).sort({ createdAt: 1 });
//     // Busca el índice de la sesión actual
//     const participantNumber =
//       sessions.findIndex((s) => s.sessionId === sessionId) + 1;

//     res.json({ success: true, id: updated._id, participantNumber });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

app.post("/api/append-result/:experimentID", async (req, res) => {
  try {
    let { sessionId } = req.body;
    if (!sessionId)
      return res
        .status(400)
        .json({ success: false, error: "sessionId required" });

    // Solo crear si no existe
    let existing = await SessionResult.findOne({
      experimentID: req.params.experimentID,
      sessionId,
    });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, error: "Session already exists" });
    }

    const created = await SessionResult.create({
      experimentID: req.params.experimentID,
      sessionId,
    });

    // Obtener participantNumber
    const sessions = await SessionResult.find({
      experimentID: req.params.experimentID,
    }).sort({ createdAt: 1 });
    const participantNumber =
      sessions.findIndex((s) => s.sessionId === sessionId) + 1;

    res.json({ success: true, id: created._id, participantNumber });
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

    // Solo añadir si existe
    let existing = await SessionResult.findOne({
      experimentID: req.params.experimentID,
      sessionId,
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    existing.data.push(response);
    await existing.save();

    // Obtener participantNumber
    const sessions = await SessionResult.find({
      experimentID: req.params.experimentID,
    }).sort({ createdAt: 1 });
    const participantNumber =
      sessions.findIndex((s) => s.sessionId === sessionId) + 1;

    res.json({ success: true, id: existing._id, participantNumber });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para obtener los resultados de una sesión
app.get("/api/session-results/:experimentID", async (req, res) => {
  try {
    const sessions = await SessionResult.find(
      { experimentID: req.params.experimentID },
      { data: 0 }
    ).sort({
      createdAt: -1,
    });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/download-session/:sessionId/:experimentID", async (req, res) => {
  try {
    const { sessionId } = req.params;

    // 1. Buscar el documento
    const doc = await SessionResult.findOne({
      experimentID: req.params.experimentID,
      sessionId,
    });
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
      const deleted = await SessionResult.findOneAndDelete({
        experimentID: req.params.experimentID,
        sessionId: req.params.sessionId,
      });
      if (!deleted) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// Middleware to handle 404 errors
app.use((req, res) => {
  console.log(`404 Not Found: ${req.url}`);
  res.status(404).send("This page doesn't exist.");
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Experiment URL: http://localhost:${port}/experiment`);
  console.log(`🔗 API URL: http://localhost:${port}/api`);
});
