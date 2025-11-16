import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const componentsDir = path.resolve(__dirname, "./components");
const responseComponentsDir = path.resolve(__dirname, "./response_components");
const pluginFile = path.resolve(__dirname, "./index.ts");
const metadataDir = path.resolve(__dirname, "../metadata");
const outputDir = path.resolve(__dirname, "./components-metadata");

// Mapeo base de tipos de ParameterType a tipos simplificados
const typeMap = {
  AUDIO: "string",
  STRING: "string",
  HTML_STRING: "html_string",
  INT: "number",
  FLOAT: "number",
  BOOL: "boolean",
  FUNCTION: "function",
  OBJECT: "object",
  COMPLEX: "object",
  IMAGE: "string",
  VIDEO: "string",
  KEYS: "string_array",
};

function extractInfoObject(content) {
  // Buscar el objeto info (puede ser con <const> o sin él)
  let infoMatch = content.match(
    /const\s+info\s*=\s*<const>\s*\{([\s\S]*?)\n\};/
  );

  if (!infoMatch) {
    // Intentar sin <const>
    infoMatch = content.match(/const\s+info\s*=\s*\{([\s\S]*?)\n\};/);
  }

  if (!infoMatch) return null;

  const infoContent = infoMatch[1];
  const info = {};

  // Extraer name
  const nameMatch = infoContent.match(/name:\s*["']([^"']+)["']/);
  if (nameMatch) info.name = nameMatch[1];

  // Extraer version (puede estar en diferentes formatos)
  let versionMatch = content.match(/var\s+version\s*=\s*["']([^"']+)["']/);
  if (!versionMatch) {
    // Intentar extraer de import
    versionMatch = infoContent.match(/version:\s*version/);
    if (versionMatch) {
      // Buscar el import
      const importMatch = content.match(
        /import\s*\{[^}]*version[^}]*\}\s*from\s*["']([^"']+)["']/
      );
      if (importMatch) {
        info.version = "imported";
      }
    }
  } else {
    info.version = versionMatch[1];
  }

  // Extraer parameters
  const parametersMatch = infoContent.match(
    /parameters:\s*\{([\s\S]*?)\n\s{2}\},/
  );
  if (parametersMatch) {
    info.parameters = extractParameters(parametersMatch[1]);
  }

  // Extraer data
  const dataMatch = infoContent.match(/data:\s*\{([\s\S]*?)\n\s{2}\},/);
  if (dataMatch) {
    info.data = extractParameters(dataMatch[1]);
  }

  return info;
}

function extractParameters(paramsContent) {
  const parameters = {};

  // Dividir por parámetros (cada uno termina con },)
  const paramBlocks = paramsContent.split(/\n\s{4}(?=[a-zA-Z_])/);

  for (const block of paramBlocks) {
    if (!block.trim()) continue;

    // Extraer nombre del parámetro
    const nameMatch = block.match(/^([a-zA-Z_][a-zA-Z0-9_]*):/);
    if (!nameMatch) continue;

    const paramName = nameMatch[1];
    const param = {};

    // Extraer type
    const typeMatch = block.match(/type:\s*ParameterType\.([A-Z_]+)/);
    if (typeMatch) {
      param.type = typeMap[typeMatch[1]] || typeMatch[1].toLowerCase();
    }

    // Verificar si es array
    const arrayMatch = block.match(/array:\s*(true|false)/);
    if (arrayMatch && arrayMatch[1] === "true") {
      param.type = `${param.type}_array`;
    }

    // Extraer default
    const defaultMatch = block.match(/default:\s*(.+?)(?:,\n|$)/s);
    if (defaultMatch) {
      const defaultValue = defaultMatch[1].trim();

      if (defaultValue === "void 0" || defaultValue === "undefined") {
        param.default = undefined;
      } else if (defaultValue === "null") {
        param.default = null;
      } else if (defaultValue === "true") {
        param.default = true;
      } else if (defaultValue === "false") {
        param.default = false;
      } else if (defaultValue.match(/^["'].*["']$/)) {
        param.default = defaultValue.slice(1, -1);
      } else if (defaultValue.match(/^\d+$/)) {
        param.default = parseInt(defaultValue);
      } else if (defaultValue.match(/^\d+\.\d+$/)) {
        param.default = parseFloat(defaultValue);
      } else if (defaultValue.startsWith("[") && defaultValue.endsWith("]")) {
        try {
          param.default = JSON.parse(defaultValue.replace(/'/g, '"'));
        } catch {
          param.default = defaultValue;
        }
      } else if (defaultValue.startsWith("{") && defaultValue.includes("}")) {
        // Extraer objeto completo incluyendo saltos de línea
        const objMatch = block.match(/default:\s*(\{[\s\S]*?\})/);
        if (objMatch) {
          try {
            param.default = JSON.parse(objMatch[1].replace(/'/g, '"'));
          } catch {
            param.default = objMatch[1];
          }
        }
      } else if (
        defaultValue.startsWith("function") ||
        defaultValue.includes("=>")
      ) {
        param.default = defaultValue;
      } else {
        param.default = defaultValue;
      }
    }

    // Extraer pretty_name
    const prettyMatch = block.match(/pretty_name:\s*["']([^"']+)["']/);
    if (prettyMatch) {
      param.pretty_name = prettyMatch[1];
    }

    // Extraer description
    const descMatch = block.match(/description:\s*["']([^"']+)["']/);
    if (descMatch) {
      param.description = descMatch[1];
    }

    parameters[paramName] = param;
  }

  return parameters;
}

async function extractComponentInfo(filePath, componentName) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const info = extractInfoObject(content);

    if (!info) {
      console.warn(`No info object found in ${componentName}`);
      return null;
    }

    // Asegurar que tenga name
    if (!info.name) {
      info.name = componentName;
    }

    return info;
  } catch (err) {
    console.error(`Failed on ${componentName}: ${err.message}`);
    return null;
  }
}

async function extractAllComponents() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(metadataDir, { recursive: true });

  // Process main plugin (DynamicPlugin)
  console.log("\n🔧 Processing main plugin...");
  try {
    const info = await extractComponentInfo(pluginFile, "DynamicPlugin");

    if (info) {
      const json = JSON.stringify(info, null, 2);
      const outPath = path.join(metadataDir, `plugin-dynamic.json`);
      await fs.writeFile(outPath, json);
      console.log(
        `Extracted: plugin-dynamic.json (version: ${info.version}) -> metadata/`
      );
    }
  } catch (err) {
    console.error(`Failed to process main plugin: ${err.message}`);
  }

  // Process stimulus components
  console.log("\n📦 Processing stimulus components...");
  const stimulusFiles = await fs.readdir(componentsDir);
  const tsFiles = stimulusFiles.filter((item) => item.endsWith(".ts"));

  for (const tsFileName of tsFiles) {
    const tsFile = path.join(componentsDir, tsFileName);
    const componentName = path.basename(tsFileName, ".ts");

    // Skip if it's a directory marker or special file
    const stats = await fs.stat(tsFile);
    if (!stats.isFile()) continue;

    const info = await extractComponentInfo(tsFile, componentName);

    if (info) {
      // Convert ComponentName to component-name format
      const kebabName = componentName
        .replace(/Component$/, "")
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase()
        .replace(/^-/, "");

      const json = JSON.stringify(info, null, 2);
      const outPath = path.join(outputDir, `${kebabName}-component.json`);
      await fs.writeFile(outPath, json);
      console.log(
        `Extracted: ${kebabName}-component.json (version: ${info.version})`
      );
    }
  }

  // Process response components
  console.log("\n📦 Processing response components...");
  const responseFiles = await fs.readdir(responseComponentsDir);
  const responseTs = responseFiles.filter((item) => item.endsWith(".ts"));

  for (const tsFileName of responseTs) {
    const tsFile = path.join(responseComponentsDir, tsFileName);
    const componentName = path.basename(tsFileName, ".ts");

    const stats = await fs.stat(tsFile);
    if (!stats.isFile()) continue;

    const info = await extractComponentInfo(tsFile, componentName);

    if (info) {
      // Convert ComponentName to component-name format
      const kebabName = componentName
        .replace(/Component$/, "")
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase()
        .replace(/^-/, "");

      const json = JSON.stringify(info, null, 2);
      const outPath = path.join(outputDir, `${kebabName}-component.json`);
      await fs.writeFile(outPath, json);
      console.log(
        `Extracted: ${kebabName}-component.json (version: ${info.version})`
      );
    }
  }

  console.log("\n✅ Extraction complete!");
}

extractAllComponents();
