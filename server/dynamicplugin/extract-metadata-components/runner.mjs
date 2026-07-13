import fs from "fs/promises";
import path from "path";
import { extractInfoObject } from "./parser.mjs";
import {
  componentNameToKebab,
  normalizeComponentMetadata,
  normalizePluginMetadata,
} from "./normalize.mjs";

async function extractComponentInfo(filePath, componentName) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const info = extractInfoObject(content);

    if (!info) {
      console.warn(`No info object found in ${componentName}`);
      return null;
    }

    if (!info.name) info.name = componentName;
    return info;
  } catch (err) {
    console.error(`Failed on ${componentName}: ${err.message}`);
    return null;
  }
}

async function writeJson(filePath, info) {
  const json = JSON.stringify(info, null, 2);
  await fs.writeFile(filePath, json);
}

async function processMainPlugin({ pluginFile, metadataDir }) {
  console.log("\nProcessing main plugin...");
  try {
    const rawInfo = await extractComponentInfo(pluginFile, "DynamicPlugin");
    const info = rawInfo ? normalizePluginMetadata(rawInfo) : null;

    if (info) {
      const outPath = path.join(metadataDir, "plugin-dynamic.json");
      await writeJson(outPath, info);
      console.log(
        `Extracted: plugin-dynamic.json (version: ${info.version}) -> metadata/`,
      );
    }
  } catch (err) {
    console.error(`Failed to process main plugin: ${err.message}`);
  }
}

async function processComponentDir({ inputDir, outputDir, label }) {
  console.log(`\nProcessing ${label} components...`);
  const files = await fs.readdir(inputDir);
  const tsFiles = files.filter((item) => item.endsWith(".ts"));

  for (const tsFileName of tsFiles) {
    const tsFile = path.join(inputDir, tsFileName);
    const componentName = path.basename(tsFileName, ".ts");
    const stats = await fs.stat(tsFile);
    if (!stats.isFile()) continue;

    const rawInfo = await extractComponentInfo(tsFile, componentName);
    const info = rawInfo ? normalizeComponentMetadata(rawInfo) : null;

    if (info) {
      const kebabName = componentNameToKebab(componentName);
      const outPath = path.join(outputDir, `${kebabName}-component.json`);
      await writeJson(outPath, info);
      console.log(
        `Extracted: ${kebabName}-component.json (version: ${info.version})`,
      );
    }
  }
}

export async function extractAllComponents({
  componentsDir,
  responseComponentsDir,
  pluginFile,
  metadataDir,
  outputDir,
}) {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(metadataDir, { recursive: true });

  await processMainPlugin({ pluginFile, metadataDir });
  await processComponentDir({
    inputDir: componentsDir,
    outputDir,
    label: "stimulus",
  });
  await processComponentDir({
    inputDir: responseComponentsDir,
    outputDir,
    label: "response",
  });

  console.log("\nExtraction complete!");
}
