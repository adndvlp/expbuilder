// Updated api.js with improved static file serving
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import fs from "fs";
import cors from "cors";
import { Parser } from "json2csv";
import dotenv from "dotenv";
import { spawn } from "child_process"; // Para script de extract-metadata.mjs en run-experiment

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Configure CORS to allow requests from your frontend
app.use(
  cors({
    origin: "http://localhost:5173", // Replace with your frontend URL if different
    // origin: "https://adndvlp.github.io",
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" })); // Increased limit for larger code files

mongoose.connect(process.env.MONGODB_URI);

// Setup static file serving
app.use(express.static(path.join(__dirname, "dist"))); // Serve dist/ at root level
app.use(express.static(path.join(__dirname))); // Serve root directory
app.use(express.static(path.join(__dirname, "plugins"))); // Serve app/ directory

// Serve the experiment page
app.get("/experiment", (req, res) => {
  res.sendFile(path.join(__dirname, "experiment.html"));
});

app.get("/trials-preview", (req, res) => {
  res.sendFile(path.join(__dirname, "trials_preview.html"));
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

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const ext = path.extname(file.originalname).toLowerCase();
    let folder = "others";
    if (/\.(png|jpg|jpeg|gif)$/i.test(ext)) folder = "img";
    else if (/\.(mp3|wav|ogg|m4a)$/i.test(ext)) folder = "aud";
    else if (/\.(mp4|webm|mov|avi)$/i.test(ext)) folder = "vid";
    return {
      folder,
      public_id: file.originalname.replace(/\.[^/.]+$/, ""),
      resource_type: "auto",
    };
  },
});

const upload = multer({ storage });

app.post("/api/upload-file", upload.single("file"), (req, res) => {
  if (!req.file || !req.file.path) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({ fileUrl: req.file.path, folder: req.file.folder });
});

app.post("/api/upload-files-folder", upload.array("files"), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  // Si la petición indica folder "all", asignar carpeta según tipo
  // El frontend puede enviar folder en req.body.folder, si no, usar "all" por defecto
  const folderParam = req.body.folder || "all";
  const fileUrls = [];

  req.files.forEach((file) => {
    // Detectar tipo por extensión
    const ext = path.extname(file.originalname).toLowerCase();
    let folder = "others";
    if (folderParam === "all") {
      if (/\.(png|jpg|jpeg|gif)$/i.test(ext)) folder = "img";
      else if (/\.(mp3|wav|ogg|m4a)$/i.test(ext)) folder = "aud";
      else if (/\.(mp4|webm|mov|avi)$/i.test(ext)) folder = "vid";
    } else {
      folder = folderParam;
    }

    // Mover el archivo a la carpeta correspondiente en Cloudinary
    // Si ya está en la carpeta correcta, no hacer nada
    // Si no, subir de nuevo a la carpeta correcta
    if (file.folder !== folder) {
      // Re-subir a la carpeta correcta usando Cloudinary
      // (No se puede mover en Cloudinary, hay que re-subir)
      cloudinary.uploader.upload(
        file.path,
        {
          folder,
          public_id: file.originalname.replace(/\.[^/.]+$/, ""),
          resource_type: "auto",
        },
        (err, result) => {
          if (!err && result && result.secure_url) {
            fileUrls.push(result.secure_url);
          } else {
            fileUrls.push(file.path); // fallback
          }
        }
      );
    } else {
      fileUrls.push(file.path);
    }
  });

  // Esperar a que todos los uploads terminen (si hubo re-subidas)
  // Si hay re-subidas, puede que fileUrls no esté completo aún
  // Para simplificar, responder con los paths originales y advertir que los nuevos estarán en la carpeta correcta
  res.json({
    fileUrls,
    info: "Archivos subidos. Si folder=all, se asignan a carpeta según tipo.",
  });
});

// app.get("/api/list-files/:folder", async (req, res) => {
//   const folder = req.params.folder;
//   let resourceType = "image";
//   if (folder === "aud") resourceType = "video"; // audio but cloudinary treats it as video
//   if (folder === "vid") resourceType = "video";
//   try {
//     const result = await cloudinary.search
//       .expression(`resource_type:${resourceType} AND folder:${folder}`)
//       .sort_by("created_at", "desc")
//       .max_results(100)
//       .execute();
//     const files = result.resources.map((file) => ({
//       name: `${folder}/${file.public_id.replace(/^.*?\//, "")}${
//         file.format ? "." + file.format : ""
//       }`,
//       url: file.secure_url,
//     }));
//     res.json({ files });
//   } catch (err) {
//     res.status(500).json({ files: [], error: err.message });
//   }
// });

app.get("/api/list-files/:folder", async (req, res) => {
  const folder = req.params.folder;

  try {
    let files = [];

    if (folder === "all") {
      // Para "all", buscar en todas las carpetas (img, aud, vid)
      const folders = ["img", "aud", "vid"];

      for (const currentFolder of folders) {
        let resourceType = "image";
        if (currentFolder === "aud") resourceType = "video"; // audio but cloudinary treats it as video
        if (currentFolder === "vid") resourceType = "video";

        const result = await cloudinary.search
          .expression(
            `resource_type:${resourceType} AND folder:${currentFolder}`
          )
          .sort_by("created_at", "desc")
          .max_results(100)
          .execute();

        const folderFiles = result.resources.map((file) => ({
          name: `${currentFolder}/${file.public_id.replace(/^.*?\//, "")}${
            file.format ? "." + file.format : ""
          }`,
          url: file.secure_url,
        }));

        files = files.concat(folderFiles);
      }
    } else {
      // Lógica original para carpetas específicas
      let resourceType = "image";
      if (folder === "aud") resourceType = "video"; // audio but cloudinary treats it as video
      if (folder === "vid") resourceType = "video";

      const result = await cloudinary.search
        .expression(`resource_type:${resourceType} AND folder:${folder}`)
        .sort_by("created_at", "desc")
        .max_results(100)
        .execute();

      files = result.resources.map((file) => ({
        name: `${folder}/${file.public_id.replace(/^.*?\//, "")}${
          file.format ? "." + file.format : ""
        }`,
        url: file.secure_url,
      }));
    }

    res.json({ files });
  } catch (err) {
    res.status(500).json({ files: [], error: err.message });
  }
});

app.delete("/api/delete-file/:folder/:filename", async (req, res) => {
  let { folder, filename } = req.params;
  filename = filename.replace(/\.[^/.]+$/, ""); // sin extensión

  // Si folder es "all", intentar borrar en todas las carpetas
  const folders = folder === "all" ? ["img", "aud", "vid", "others"] : [folder];
  let deleted = false;
  let lastError = null;

  for (const f of folders) {
    let resourceType = "image";
    if (f === "aud" || f === "vid") resourceType = "video";
    try {
      const result = await cloudinary.uploader.destroy(`${f}/${filename}`, {
        resource_type: resourceType,
      });
      if (result.result === "ok") {
        deleted = true;
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({
      success: false,
      error: lastError ? lastError.message : "File not found",
    });
  }
});

const ConfigSchema = new mongoose.Schema(
  {
    data: { type: Object, required: true },
    isDevMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Config = mongoose.models.Config || mongoose.model("Config", ConfigSchema);

const TrialsSchema = new mongoose.Schema(
  { data: { type: Object, required: true } },
  { timestamps: true }
);
const Trials = mongoose.models.Trials || mongoose.model("Trials", TrialsSchema);

app.get("/api/load-trials", async (req, res) => {
  try {
    const trialsDoc = await Trials.findOne({});
    if (!trialsDoc) return res.json({ trials: null });
    res.json({ trials: trialsDoc.data });
  } catch (error) {
    res.status(500).json({ trials: null, error: error.message });
  }
});

app.post("/api/save-trials", async (req, res) => {
  try {
    const trials = req.body;
    const updated = await Trials.findOneAndUpdate(
      {},
      { data: trials },
      { upsert: true, new: true }
    );
    res.json({ success: true, trials: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/trials/:id", async (req, res) => {
  try {
    // Convierte el id a número para que coincida con el tipo en la base de datos
    const idToDelete = Number(req.params.id);

    // Elimina el trial del array trials dentro del documento
    const updated = await Trials.findOneAndUpdate(
      { "data.trials.id": idToDelete },
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

// Save or update a plugin by index, previous enpoint
// app.post("/api/save-plugins", async (req, res) => {
//   try {
//     const { name, scripTag, pluginCode, index } = req.body;
//     if (typeof index !== "number")
//       return res.status(400).json({ success: false, error: "Index required" });

//     const plugin = { name, scripTag, pluginCode, index };

//     let doc = await PluginConfig.findOne({});
//     if (!doc) {
//       doc = await PluginConfig.create({ plugins: [plugin] });
//       return res.json({ success: true, plugin });
//     }

//     const i = doc.plugins.findIndex((p) => p.index === index);
//     if (i >= 0) doc.plugins[i] = plugin;
//     else doc.plugins.push(plugin);

//     await doc.save();
//     res.json({ success: true, plugin });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// Save or update a plugin by index
app.post("/api/save-plugins", async (req, res) => {
  try {
    const { name, scripTag, pluginCode, index } = req.body;
    if (typeof index !== "number")
      return res.status(400).json({ success: false, error: "Index required" });

    const plugin = { name, scripTag, pluginCode, index };

    let doc = await PluginConfig.findOne({});
    if (!doc) {
      doc = await PluginConfig.create({ plugins: [plugin] });
    } else {
      const existingPluginIndex = doc.plugins.findIndex(
        (p) => p.index === index
      );

      // Si estamos actualizando un plugin existente
      if (existingPluginIndex >= 0) {
        const oldPlugin = doc.plugins[existingPluginIndex];

        // Verificar si hay cambios en nombre, scripTag o código
        const nameChanged = oldPlugin.name !== name;
        const scripTagChanged = oldPlugin.scripTag !== scripTag;
        const codeChanged = oldPlugin.pluginCode !== pluginCode;

        // Si hay cualquier cambio, limpiar archivos anteriores
        if (nameChanged || scripTagChanged || codeChanged) {
          // Eliminar archivo anterior del plugin
          if (oldPlugin.scripTag) {
            const oldFileName = path.basename(oldPlugin.scripTag);
            const oldFilePath = path.join(__dirname, "plugins", oldFileName);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log(`🗑️ Deleted old plugin file: ${oldFileName}`);
            }
          }

          // Eliminar metadata anterior
          if (oldPlugin.name) {
            const oldMetadataPath = path.join(
              __dirname,
              "metadata",
              `${oldPlugin.name}.json`
            );
            if (fs.existsSync(oldMetadataPath)) {
              fs.unlinkSync(oldMetadataPath);
              console.log(`🗑️ Deleted old metadata: ${oldPlugin.name}.json`);
            }
          }

          // Si el nombre cambió y es diferente al nuevo, eliminar también la nueva metadata si existe
          if (nameChanged && name !== oldPlugin.name) {
            const newMetadataPath = path.join(
              __dirname,
              "metadata",
              `${name}.json`
            );
            if (fs.existsSync(newMetadataPath)) {
              fs.unlinkSync(newMetadataPath);
              console.log(
                `🗑️ Deleted existing metadata for new name: ${name}.json`
              );
            }
          }
        }

        // Actualizar el plugin existente
        doc.plugins[existingPluginIndex] = plugin;
      } else {
        // Agregar nuevo plugin
        doc.plugins.push(plugin);
      }
    }

    await doc.save();

    // Escribir o sobrescribir el archivo del plugin
    if (pluginCode && scripTag) {
      const pluginsDir = path.join(__dirname, "plugins");
      if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir);

      const fileName = path.basename(scripTag);
      const filePath = path.join(pluginsDir, fileName);
      fs.writeFileSync(filePath, pluginCode, "utf8");
      console.log(`💾 Saved plugin file: ${fileName}`);
    }

    // Siempre eliminar metadata actual para forzar regeneración
    const metadataPath = path.join(__dirname, "metadata", `${name}.json`);
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
      console.log(`🗑️ Deleted metadata for regeneration: ${name}.json`);
    }

    // inserción de script en experiment.html
    let plugins = [];

    const pluginConfigDoc = await PluginConfig.findOne({});
    plugins = pluginConfigDoc?.plugins || [];

    if (!plugins.length) {
      return res
        .status(404)
        .json({ success: false, error: "No plugins found" });
    }

    const pluginsDir = path.join(__dirname, "plugins");
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir);

    // plugins.forEach((plugin) => {
    //   if (plugin.pluginCode && plugin.scripTag) {
    //     const fileName = path.basename(plugin.scripTag);
    //     const filePath = path.join(pluginsDir, fileName);
    //     fs.writeFileSync(filePath, plugin.pluginCode, "utf8");
    //   }
    // });

    // Ejecutar extract-metadata.mjs después de escribir los plugins
    console.log("🔄 Running extract-metadata script...");
    try {
      await new Promise((resolve, reject) => {
        const extractScript = spawn(
          "node",
          [path.join(__dirname, "extract-metadata.mjs")],
          {
            cwd: __dirname,
            stdio: "inherit", // Para ver la salida en la consola del servidor
          }
        );

        extractScript.on("close", (code) => {
          if (code === 0) {
            console.log("✅ Extract-metadata script completed successfully");
            resolve();
          } else {
            console.error(
              `❌ Extract-metadata script failed with code ${code}`
            );
            // No rechazamos aquí para que el experimento pueda continuar
            resolve();
          }
        });

        extractScript.on("error", (err) => {
          console.error(
            `❌ Error running extract-metadata script: ${err.message}`
          );
          // No rechazamos aquí para que el experimento pueda continuar
          resolve();
        });
      });
    } catch (metadataError) {
      console.error(
        `❌ Error with metadata extraction: ${metadataError.message}`
      );
      // Continuamos con el experimento aunque falle la extracción de metadata
    }

    const html1Path = path.join(__dirname, "experiment.html");
    const html2Path = path.join(__dirname, "trials_preview.html");

    // Leer cada HTML
    let html1 = fs.readFileSync(html1Path, "utf8");
    let html2 = fs.readFileSync(html2Path, "utf8");

    // Cargar en Cheerio
    const $1 = cheerio.load(html1);
    const $2 = cheerio.load(html2);

    // Limpiar scripts antiguos
    $1("script[id^='plugin-script']").remove();
    $2("script[id^='plugin-script']").remove();

    // Insertar los plugins en ambos
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

    // Guardar los HTML modificados
    fs.writeFileSync(html1Path, $1.html(), "utf8");
    fs.writeFileSync(html2Path, $2.html(), "utf8");
    console.log("script insertion completed");

    res.json({ success: true, plugin });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a plugin by index, previous endpoint
// app.delete("/api/delete-plugin/:index", async (req, res) => {
//   try {
//     const index = Number(req.params.index);
//     if (isNaN(index)) {
//       return res.status(400).json({ success: false, error: "Invalid index" });
//     }
//     const updated = await PluginConfig.findOneAndUpdate(
//       {},
//       { $pull: { plugins: { index } } },
//       { new: true }
//     );
//     if (!updated) {
//       return res.status(404).json({ success: false, error: "No config doc" });
//     }
//     const stillThere = updated.plugins.some((p) => p.index === index);
//     if (stillThere) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Plugin not found" });
//     }
//     res.json({ success: true });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// Delete a plugin by index
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

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para cargar la configuración de plugin
app.get("/api/load-plugin-config", async (req, res) => {
  try {
    const doc = await PluginConfig.findOne({});
    res.json({ config: doc?.config ?? null, plugins: doc?.plugins ?? [] });
  } catch (error) {
    res.status(500).json({ config: null, error: error.message });
  }
});

app.get("/api/load-config", async (req, res) => {
  try {
    const configDoc = await Config.findOne({});
    if (!configDoc) return res.json({ config: null, isDevMode: false });
    res.json({ config: configDoc.data, isDevMode: configDoc.isDevMode });
  } catch (error) {
    res
      .status(500)
      .json({ config: null, isDevMode: false, error: error.message });
  }
});

// API endpoint to save configuration and generated code
app.post("/api/save-config", async (req, res) => {
  try {
    const { config, isDevMode } = req.body;
    const updated = await Config.findOneAndUpdate(
      {},
      { data: config, isDevMode: isDevMode },
      { upsert: true, new: true }
    );
    res.json({ success: true, config: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/run-experiment", async (req, res) => {
  try {
    const { generatedCode } = req.body;

    const experimentHtmlPath = path.join(__dirname, "experiment.html");
    if (!fs.existsSync(experimentHtmlPath)) {
      return res
        .status(500)
        .json({ success: false, error: "experiment.html not found" });
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
      experimentUrl: "http://localhost:3000/experiment",
    });
  } catch (error) {
    console.error(`Error running experiment: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/trials-preview", async (req, res) => {
  try {
    const { generatedCode } = req.body;

    const experimentHtmlPath = path.join(__dirname, "trials_preview.html");
    if (!fs.existsSync(experimentHtmlPath)) {
      return res
        .status(500)
        .json({ success: false, error: "trials_preview.html not found" });
    }
    let html = fs.readFileSync(experimentHtmlPath, "utf8");
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
    fs.writeFileSync(experimentHtmlPath, $.html());

    res.json({
      success: true,
      message: "Experiment built and ready to run",
      experimentUrl: "http://localhost:3000/trials_preview",
    });
  } catch (error) {
    console.error(`Error running experiment: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Modelo para resultados individuales por participante
const SessionResultSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  data: { type: Array, default: [] },
});
const SessionResult =
  mongoose.models.SessionResult ||
  mongoose.model("SessionResult", SessionResultSchema);

// Endpoint para agregar una respuesta a la sesión
app.post("/api/append-result", async (req, res) => {
  try {
    let { sessionId, response } = req.body;
    if (!sessionId || !response)
      return res
        .status(400)
        .json({ success: false, error: "sessionId and response required" });

    // Si recibes un string, parsea:
    if (typeof response === "string") response = JSON.parse(response);

    // Busca el documento o créalo si no existe
    const updated = await SessionResult.findOneAndUpdate(
      { sessionId },
      { $push: { data: response } },
      { upsert: true, new: true }
    );

    res.json({ success: true, id: updated._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para obtener los resultados de una sesión
app.get("/api/session-results", async (req, res) => {
  try {
    const sessions = await SessionResult.find({}, { data: 0 }).sort({
      createdAt: -1,
    });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/download-session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    // 1. Buscar el documento
    const doc = await SessionResult.findOne({ sessionId });
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

app.delete("/api/session-results/:sessionId", async (req, res) => {
  try {
    const deleted = await SessionResult.findOneAndDelete({
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
});

// Middleware to handle 404 errors
app.use((req, res) => {
  console.log(`404 Not Found: ${req.url}`);
  res.status(404).send("This page doesn't exist.");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`- Experiment URL: http://localhost:${port}/experiment`);
});
