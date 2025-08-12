import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pluginsDir = [path.resolve(__dirname, "./plugins")];

const outputDir = path.resolve(__dirname, "metadata");

// Mapeo base de tipos
const typeMap = {
  audio: "string",
  string: "string",
  html_string: "string",
  int: "number",
  float: "number",
  bool: "boolean",
  function: "function",
  object: "object",
  coordinates: "coordinates",
  array: "array",
  keys: "string_array",
  undefined: "undefined",
  null: "null",
};

// Normaliza tipo compuesto como array_int → number_array
function resolveFieldType(paramType) {
  const arrayMatch = paramType.match(/^array_(.+)$/);
  if (arrayMatch) {
    const baseType = arrayMatch[1];
    const baseResolved = typeMap[baseType] || baseType;
    return `${baseResolved}_array`;
  }

  if (Object.values(typeMap).includes(paramType)) {
    return paramType;
  }
  // return typeMap[paramType] || "string";
  return typeMap[paramType] || paramType;
}

async function extractInfoObjects() {
  await fs.mkdir(outputDir, { recursive: true });
  for (const pluginsPath of pluginsDir) {
    let pluginDirs = [];
    try {
      pluginDirs = await fs.readdir(pluginsPath);
    } catch (e) {
      console.warn(`No se pudo leer el directorio: ${pluginsPath}`);
      continue;
    }

    // for (const dir of pluginDirs) {
    //   const jsFile = path.join(pluginsPath, dir, "index.js");

    const jsFiles = pluginDirs.filter((item) => item.endsWith(".js"));

    for (const jsFileName of jsFiles) {
      const jsFile = path.join(pluginsPath, jsFileName);
      const pluginName = path.basename(jsFileName, ".js");

      try {
        const exists = await fs
          .stat(jsFile)
          .then(() => true)
          .catch(() => false);
        if (!exists) continue;

        const content = await fs.readFile(jsFile, "utf-8");

        // Extract the version string from the file (var or const)
        const versionMatch =
          content.match(/var version\s*=\s*["']([^"']+)["']/) ||
          content.match(/const version\s*=\s*["']([^"']+)["']/);

        const versionString = versionMatch
          ? versionMatch[1]
          : "unknown_version";

        // Extract the info object
        const infoMatch = content.match(/const info\s*=\s*({[\s\S]*?});/);

        if (infoMatch) {
          let infoObject = infoMatch[1];

          // Replace version shorthand property with full key-value pair string
          infoObject = infoObject.replace(
            /\bversion\b\s*[:,]?/,
            `"version": "${versionString}",`
          );

          // Replace ParameterType constants with strings
          const paramTypeMap = {
            AUDIO: "audio",
            STRING: "string",
            INT: "int",
            FLOAT: "float",
            BOOL: "bool",
            FUNCTION: "function",
            HTML_STRING: "html_string",
            OBJECT: "object",
            COORDINATES: "coordinates",
            ARRAY: "array",
          };
          infoObject = infoObject.replace(
            /ParameterType\.([A-Z_]+)/g,
            (_, key) => `"${paramTypeMap[key] || key.toLowerCase()}"`
          );

          let info = eval("(" + infoObject + ")");

          // Analiza cada parámetro para detectar arrays o combinaciones
          for (const param of Object.values(info.parameters)) {
            if ("default" in param && param.default === undefined) {
              param.default = "__undefined__";
            }

            if (param.array) {
              param.type = `array_${param.type}`;
              delete param.array;
            }

            // Normaliza tipo final
            param.type = resolveFieldType(param.type);
            // Si es tipo function y default es void 0, poner undefined
            if (
              param.type === "function" &&
              (param.default === "void 0" || param.default === "__undefined__")
            ) {
              param.default = undefined;
            }

            // Si es tipo function y default es una función, convertir a string
            if (
              param.type === "function" &&
              typeof param.default === "function"
            ) {
              param.default = param.default.toString();
            }
          }

          const json = JSON.stringify(info, null, 2);

          const outPath = path.join(outputDir, `${pluginName}.json`);
          await fs.writeFile(outPath, json);
          console.log(
            `✅ Extracted info from: ${pluginName} (version: ${versionString})`
          );
        } else {
          console.warn(`⚠️ No info object in ${pluginName}`);
        }
      } catch (err) {
        console.error(`❌ Failed on ${pluginName}: ${err.message}`);
      }
    }
  }
}

extractInfoObjects();
