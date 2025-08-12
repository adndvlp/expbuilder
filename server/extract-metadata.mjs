import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "acorn";
import * as walk from "acorn-walk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pluginsDir = [path.resolve(__dirname, "./plugins")];
const outputDir = path.resolve(__dirname, "metadata");

// Mapeo base de tipos
const typeMap = {
  audio: "string",
  string: "string",
  html_string: "html_string",
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
  return typeMap[paramType] || paramType;
}

function flattenMemberExpression(node) {
  if (node.type !== "MemberExpression") return "";
  const object =
    node.object.type === "Identifier"
      ? node.object.name
      : flattenMemberExpression(node.object);
  const property =
    node.property.type === "Identifier"
      ? node.property.name
      : `[${parseValue(node.property)}]`;
  return `${object}.${property}`;
}

function parseValue(valNode, content) {
  if (!valNode) return null;

  switch (valNode.type) {
    case "TemplateLiteral":
      const quasis = valNode.quasis.map((q) => q.value.cooked);
      const expressions = valNode.expressions.map((expr) =>
        parseValue(expr, content)
      );
      let result = "";
      for (let i = 0; i < quasis.length; i++) {
        result += quasis[i];
        if (i < expressions.length) {
          result += "${" + expressions[i] + "}";
        }
      }
      return `\`${result}\``;

    case "Literal":
      return valNode.value;

    case "ArrayExpression":
      return valNode.elements.map((el) => parseValue(el, content));

    case "ObjectExpression":
      return reconstructObject(valNode, content);

    case "Identifier":
      if (valNode.name === "undefined") return undefined;
      if (valNode.name === "true") return true;
      if (valNode.name === "false") return false;
      return valNode.name;

    case "UnaryExpression":
      if (valNode.operator === "void") return undefined;
      const arg = parseValue(valNode.argument, content);
      switch (valNode.operator) {
        case "-":
          return -arg;
        case "+":
          return +arg;
        case "!":
          return !arg;
        default:
          return `${valNode.operator}${arg}`;
      }

    case "FunctionExpression":
    case "ArrowFunctionExpression":
      return content.slice(valNode.start, valNode.end).trim();

    case "MemberExpression":
      const full = flattenMemberExpression(valNode);
      // Maneja tanto ParameterType.X como jspsych.ParameterType.X
      const match = full.match(/(?:jspsych\.)?ParameterType\.([A-Z_]+)/);
      if (match) {
        const typeKey = match[1].toLowerCase();
        return typeMap[typeKey] || typeKey;
      }
      return `[MemberExpression: ${full}]`;

    default:
      console.warn(`Unresolved node type: ${valNode.type}`, valNode);
      return `[${valNode.type}]`;
  }
}

function reconstructObject(node, content) {
  const obj = {};
  if (!node || node.type !== "ObjectExpression") return obj;

  for (const prop of node.properties) {
    const key = prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
    const val = parseValue(prop.value, content);
    obj[key] = val;
  }
  return obj;
}

async function extractInfoObjects() {
  await fs.mkdir(outputDir, { recursive: true });

  // Crear directorio para plugins que necesitan refactoring
  const failedDir = path.resolve(__dirname, "plugins-to-refactor");
  await fs.mkdir(failedDir, { recursive: true });

  for (const pluginsPath of pluginsDir) {
    let pluginDirs = [];
    try {
      pluginDirs = await fs.readdir(pluginsPath);
    } catch (e) {
      console.warn(`No se pudo leer el directorio: ${pluginsPath}`);
      continue;
    }

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

        // Usar AST parsing en lugar de eval
        let infoNode = null;
        let ast;

        try {
          ast = parse(content, { ecmaVersion: "latest", sourceType: "script" });
        } catch (parseError) {
          // Si falla como script, intentar como module
          try {
            ast = parse(content, {
              ecmaVersion: "latest",
              sourceType: "module",
            });
          } catch (moduleError) {
            throw new Error(`AST parsing failed: ${parseError.message}`);
          }
        }

        // Buscar el objeto info
        walk.simple(ast, {
          AssignmentExpression(node) {
            // Busca Plugin.info = {...} o similar
            if (
              node.left.type === "MemberExpression" &&
              node.left.property &&
              node.left.property.name === "info" &&
              node.right.type === "ObjectExpression"
            ) {
              infoNode = node.right;
            }
          },
          VariableDeclarator(node) {
            // Busca const info = {...}
            if (
              node.id &&
              node.id.name === "info" &&
              node.init &&
              node.init.type === "ObjectExpression"
            ) {
              infoNode = node.init;
            }
          },
          Property(node) {
            // Busca static info = {...} dentro de clases
            if (
              node.key &&
              node.key.name === "info" &&
              node.value &&
              node.value.type === "ObjectExpression"
            ) {
              infoNode = node.value;
            }
          },
        });

        if (!infoNode) {
          console.warn(`⚠️ No info object in ${pluginName}`);
          await copyToRefactorFolder(jsFile, pluginName, failedDir);
          await generateRefactorInstructions(pluginName, failedDir);
          continue;
        }

        // Reconstruir el objeto info
        const info = reconstructObject(infoNode, content);

        // Asegurarse de que tenga name y version
        if (!info.name) {
          info.name = pluginName;
        }
        if (!info.version) {
          info.version = versionString;
        }

        // Procesar parámetros si existen
        if (info.parameters) {
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
        }

        const json = JSON.stringify(info, null, 2);
        const outPath = path.join(outputDir, `${pluginName}.json`);
        await fs.writeFile(outPath, json);
        console.log(
          `✅ Extracted info from: ${pluginName} (version: ${versionString})`
        );
      } catch (err) {
        console.error(`❌ Failed on ${pluginName}: ${err.message}`);
        await copyToRefactorFolder(jsFile, pluginName, failedDir);
        await generateRefactorInstructions(pluginName, failedDir);
      }
    }
  }
}

async function copyToRefactorFolder(jsFile, pluginName, failedDir) {
  try {
    const content = await fs.readFile(jsFile, "utf-8");
    const failedPath = path.join(failedDir, `${pluginName}.js`);
    await fs.writeFile(failedPath, content);
    console.log(`📁 Copied ${pluginName} to refactor folder`);
  } catch (err) {
    console.error(`Failed to copy ${pluginName}: ${err.message}`);
  }
}

async function generateRefactorInstructions(pluginName, failedDir) {
  const instructions = `# Instructions to refactor ${pluginName}

## Problem
This plugin could not be processed automatically because it doesn't follow the expected standard format.

## Solution
Use any free LLM (ChatGPT, Claude, Copilot, etc.) with this prompt:

\`\`\`
Refactor this jsPsych plugin to have a standard info object:

REQUIRED FORMAT:
\`\`\`javascript
const info = {
  name: "${pluginName}",
  version: "1.0.0",
  parameters: {
    parameter_name: {
      type: "string", // use: string, number, boolean, function, object, array
      default: "default_value",
      description: "Parameter description"
    }
  },
  data: {
    property_name: {
      type: "string",
      description: "Data property description"
    }
  }
};
\`\`\`

DO NOT USE jspsych.ParameterType - use strings directly.

Original code:
[PASTE THE PLUGIN CODE HERE]

Return only the refactored JavaScript code.
\`\`\`

## After refactoring
1. Replace the original file in the plugins/ folder
2. Run extract-metadata.mjs again
`;

  const instructionsPath = path.join(
    failedDir,
    `${pluginName}-instructions.md`
  );
  await fs.writeFile(instructionsPath, instructions);
  console.log(`📝 Generated instructions for ${pluginName}`);
}

extractInfoObjects();
