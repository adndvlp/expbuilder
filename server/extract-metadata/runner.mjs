import fs from "fs/promises";
import path from "path";
import { extractPluginInfo } from "./parser.mjs";
import {
  copyToRefactorFolder,
  generateRefactorInstructions,
} from "./refactor.mjs";

async function fileExists(filePath) {
  return fs
    .stat(filePath)
    .then(() => true)
    .catch(() => false);
}

async function readPluginFiles(pluginsPath) {
  try {
    const pluginDirs = await fs.readdir(pluginsPath);
    return pluginDirs.filter((item) => item.endsWith(".js"));
  } catch {
    console.warn(`No se pudo leer el directorio: ${pluginsPath}`);
    return [];
  }
}

async function extractSinglePlugin(jsFile, pluginName, outputDir) {
  if (!(await fileExists(jsFile))) return false;

  const content = await fs.readFile(jsFile, "utf-8");
  const extracted = extractPluginInfo(content, pluginName);

  if (!extracted) {
    console.warn(`No info object in ${pluginName}`);
    return false;
  }

  const { info, versionString } = extracted;
  const json = JSON.stringify(info, null, 2);
  const outPath = path.join(outputDir, `${pluginName}.json`);
  await fs.writeFile(outPath, json);
  console.log(`Extracted info from: ${pluginName} (version: ${versionString})`);
  return true;
}

export async function extractInfoObjects({
  pluginsDir,
  outputDir,
  failedDir,
}) {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(failedDir, { recursive: true });

  for (const pluginsPath of pluginsDir) {
    const jsFiles = await readPluginFiles(pluginsPath);

    for (const jsFileName of jsFiles) {
      const jsFile = path.join(pluginsPath, jsFileName);
      const pluginName = path.basename(jsFileName, ".js");

      try {
        await extractSinglePlugin(jsFile, pluginName, outputDir);
      } catch (err) {
        console.error(`Failed on ${pluginName}: ${err.message}`);
        await copyToRefactorFolder(jsFile, pluginName, failedDir);
        await generateRefactorInstructions(pluginName, failedDir);
      }
    }
  }
}
