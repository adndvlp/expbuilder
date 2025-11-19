import { Router } from "express";
import express from "express";
import path from "path";
import fs from "fs";
import { __dirname } from "../utils/paths.js";
import { db, userDataRoot } from "../utils/db.js";
import * as cheerio from "cheerio";
import { spawn } from "child_process";

const router = Router();
const metadataPath = path.join(userDataRoot, "metadata");
if (!fs.existsSync(metadataPath))
  fs.mkdirSync(metadataPath, { recursive: true });
const componentsMetadataPath = path.join(
  userDataRoot,
  "dynamicplugin",
  "components-metadata"
);
if (!fs.existsSync(componentsMetadataPath))
  fs.mkdirSync(componentsMetadataPath, { recursive: true });

// Serve the metadata directory at `/metadata` URL path
router.use("/metadata", express.static(metadataPath));

// Serve the components metadata directory
router.use(
  "/dynamicplugin/components-metadata",
  express.static(componentsMetadataPath)
);

// Component metadata endpoint
router.get("/api/component-metadata/:componentType", (req, res) => {
  try {
    const { componentType } = req.params;
    const metadataPathFile = path.join(
      componentsMetadataPath,
      `${componentType}-component.json`
    );

    if (!fs.existsSync(metadataPathFile)) {
      return res.status(404).json({
        error: `Metadata not found for component: ${componentType}`,
      });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPathFile, "utf-8"));
    res.json(metadata);
  } catch (error) {
    console.error("Error loading component metadata:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/plugins-list", (req, res) => {
  fs.readdir(metadataPath, (err, files) => {
    if (err) return res.status(500).json({ error: "No metadata dir" });
    // Solo archivos .json
    const plugins = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
    res.json({ plugins });
  });
});

// Guardar un solo plugin por id
router.post("/api/save-plugin/:id", async (req, res) => {
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
            const oldFilePath = path.join(userDataRoot, "plugins", oldFileName);
            if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
          }
          if (oldPlugin.name) {
            const oldMetadataPath = path.join(
              metadataPath,
              `${oldPlugin.name}.json`
            );
            if (fs.existsSync(oldMetadataPath)) fs.unlinkSync(oldMetadataPath);
          }
          if (nameChanged && name !== oldPlugin.name) {
            const newMetadataPath = path.join(metadataPath, `${name}.json`);
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
      const pluginsDir = path.join(userDataRoot, "plugins");
      if (!fs.existsSync(pluginsDir))
        fs.mkdirSync(pluginsDir, { recursive: true });
      const fileName = path.basename(scripTag);
      const filePath = path.join(pluginsDir, fileName);
      fs.writeFileSync(filePath, pluginCode, "utf8");
    }

    // Eliminar metadata actual para forzar regeneración
    const metadataPathFile = path.join(metadataPath, `${name}.json`);
    if (fs.existsSync(metadataPathFile)) fs.unlinkSync(metadataPathFile);

    // Actualizar experiment_template.html y trials_preview_template.html
    await db.read();
    let plugins = [];
    const pluginConfigDoc = db.data.pluginConfigs[0];
    plugins = pluginConfigDoc?.plugins || [];
    const templatesDir = path.join(userDataRoot, "templates");
    if (!fs.existsSync(templatesDir))
      fs.mkdirSync(templatesDir, { recursive: true });
    const html1Path = path.join(templatesDir, "experiment_template.html");
    const html2Path = path.join(templatesDir, "trials_preview_template.html");
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
          [path.join(userDataRoot, "extract-metadata.mjs")],
          {
            cwd: userDataRoot,
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

router.delete("/api/delete-plugin/:index", async (req, res) => {
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
      const filePath = path.join(userDataRoot, "plugins", fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted plugin file: ${fileName}`);
      }
    }

    // Eliminar metadata
    if (pluginToDelete.name) {
      const metadataPathFile = path.join(
        metadataPath,
        `${pluginToDelete.name}.json`
      );
      if (fs.existsSync(metadataPathFile)) {
        fs.unlinkSync(metadataPathFile);
        console.log(`🗑️ Deleted metadata: ${pluginToDelete.name}.json`);
      }
    }

    // Solo borrar la etiqueta <script id="plugin-script-{index}">
    const templatesDir = path.join(userDataRoot, "templates");
    const htmlFiles = [
      path.join(templatesDir, "experiment_template.html"),
      path.join(templatesDir, "trials_preview_template.html"),
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
router.get("/api/load-plugins", async (req, res) => {
  try {
    await db.read();
    const pluginConfig = db.data.pluginConfigs[0];
    if (!pluginConfig) return res.json({ plugins: [] });
    res.json({ plugins: pluginConfig.plugins });
  } catch (error) {
    res.status(500).json({ plugins: [], error: error.message });
  }
});

export default router;
