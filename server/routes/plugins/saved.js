import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { Router } from "express";
import { db, userDataRoot } from "../../utils/db.js";
import { metadataPath, pluginsDir } from "./paths.js";
import { refreshPluginScripts, removePluginScript } from "./templates.js";

const router = Router();

function cleanupChangedPluginFiles(oldPlugin, nextPlugin) {
  const nameChanged = oldPlugin.name !== nextPlugin.name;
  const scripTagChanged = oldPlugin.scripTag !== nextPlugin.scripTag;
  const codeChanged = oldPlugin.pluginCode !== nextPlugin.pluginCode;
  if (!nameChanged && !scripTagChanged && !codeChanged) return;

  if (oldPlugin.scripTag) {
    const oldFileName = path.basename(oldPlugin.scripTag);
    const oldFilePath = path.join(pluginsDir, oldFileName);
    if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
  }
  if (oldPlugin.name) {
    const oldMetadataPath = path.join(metadataPath, `${oldPlugin.name}.json`);
    if (fs.existsSync(oldMetadataPath)) fs.unlinkSync(oldMetadataPath);
  }
  if (nameChanged && nextPlugin.name !== oldPlugin.name) {
    const newMetadataPath = path.join(metadataPath, `${nextPlugin.name}.json`);
    if (fs.existsSync(newMetadataPath)) fs.unlinkSync(newMetadataPath);
  }
}

function savePluginFile(plugin) {
  if (!plugin.pluginCode || !plugin.scripTag) return;
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }
  const fileName = path.basename(plugin.scripTag);
  const filePath = path.join(pluginsDir, fileName);
  fs.writeFileSync(filePath, plugin.pluginCode, "utf8");
}

async function runExtractMetadata() {
  let metadataStatus = "ok";
  let metadataErrorMsg = "";
  try {
    await new Promise((resolve) => {
      const extractScript = spawn(
        "node",
        [path.join(userDataRoot, "extract-metadata.mjs")],
        {
          cwd: userDataRoot,
          stdio: "inherit",
        },
      );
      extractScript.on("close", (code) => {
        if (code !== 0) {
          metadataStatus = "error";
          metadataErrorMsg = `Extract-metadata script failed with code ${code}`;
        }
        resolve();
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
  return { metadataStatus, metadataErrorMsg };
}

router.post("/api/save-plugin/:id", async (req, res) => {
  try {
    const index = Number(req.params.id);
    const { name, scripTag, pluginCode } = req.body;
    if (isNaN(index)) {
      return res.status(400).json({ success: false, error: "Index required" });
    }

    const plugin = { name, scripTag, pluginCode, index };

    await db.read();
    let pluginConfig = db.data.pluginConfigs[0];

    if (!pluginConfig) {
      pluginConfig = { plugins: [plugin], config: {} };
      db.data.pluginConfigs.push(pluginConfig);
    } else {
      const existingPluginIndex = pluginConfig.plugins.findIndex(
        (p) => p.index === index,
      );
      if (existingPluginIndex >= 0) {
        cleanupChangedPluginFiles(
          pluginConfig.plugins[existingPluginIndex],
          plugin,
        );
        pluginConfig.plugins[existingPluginIndex] = plugin;
      } else {
        pluginConfig.plugins.push(plugin);
      }
    }
    await db.write();

    savePluginFile(plugin);

    const metadataPathFile = path.join(metadataPath, `${name}.json`);
    if (fs.existsSync(metadataPathFile)) fs.unlinkSync(metadataPathFile);

    await db.read();
    const plugins = db.data.pluginConfigs[0]?.plugins || [];
    refreshPluginScripts(plugins);

    const { metadataStatus, metadataErrorMsg } = await runExtractMetadata();

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

    pluginConfig.plugins = pluginConfig.plugins.filter(
      (p) => p.index !== index,
    );
    await db.write();

    if (pluginToDelete.scripTag) {
      const fileName = path.basename(pluginToDelete.scripTag);
      const filePath = path.join(pluginsDir, fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    if (pluginToDelete.name) {
      const metadataPathFile = path.join(
        metadataPath,
        `${pluginToDelete.name}.json`,
      );
      if (fs.existsSync(metadataPathFile)) fs.unlinkSync(metadataPathFile);
    }

    removePluginScript(index);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
