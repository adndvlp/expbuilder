import fs from "fs/promises";
import path from "path";
import { parse } from "acorn";
import * as walk from "acorn-walk";

const outputDir = path.resolve(process.cwd(), "metadata");

const pluginUrls = [
  "https://unpkg.com/@jspsych/plugin-animation@2.1.0",
  "https://unpkg.com/@jspsych/plugin-audio-button-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-audio-keyboard-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-audio-slider-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-browser-check@2.1.0",
  "https://unpkg.com/@jspsych/plugin-call-function@2.1.0",
  "https://unpkg.com/@jspsych/plugin-canvas-button-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-canvas-keyboard-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-canvas-slider-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-categorize-animation@2.1.0",
  "https://unpkg.com/@jspsych/plugin-categorize-html@2.1.0",
  "https://unpkg.com/@jspsych/plugin-categorize-image@2.1.0",
  "https://unpkg.com/@jspsych/plugin-cloze@2.2.0",
  "https://unpkg.com/@jspsych/plugin-external-html@2.1.0",
  "https://unpkg.com/@jspsych/plugin-free-sort@2.1.0",
  "https://unpkg.com/@jspsych/plugin-fullscreen@2.1.0",
  "https://unpkg.com/@jspsych/plugin-html-audio-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-html-button-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-html-keyboard-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-html-slider-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-html-video-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-iat-html@2.1.0",
  "https://unpkg.com/@jspsych/plugin-iat-image@2.1.0",
  "https://unpkg.com/@jspsych/plugin-image-button-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-image-keyboard-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-image-slider-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-initialize-camera@2.1.0",
  "https://unpkg.com/@jspsych/plugin-initialize-microphone@2.1.0",
  "https://unpkg.com/@jspsych/plugin-instructions@2.1.0",
  "https://unpkg.com/@jspsych/plugin-maxdiff@2.1.0",
  "https://unpkg.com/@jspsych/plugin-mirror-camera@2.1.0",
  "https://unpkg.com/@jspsych/plugin-preload@2.1.0",
  "https://unpkg.com/@jspsych/plugin-reconstruction@2.1.0",
  "https://unpkg.com/@jspsych/plugin-resize@2.1.0",
  "https://unpkg.com/@jspsych/plugin-same-different-html@2.1.0",
  "https://unpkg.com/@jspsych/plugin-same-different-image@2.1.0",
  "https://unpkg.com/@jspsych/plugin-serial-reaction-time@2.1.0",
  "https://unpkg.com/@jspsych/plugin-serial-reaction-time-mouse@2.1.0",
  "https://unpkg.com/@jspsych/plugin-sketchpad@2.1.0",
  "https://unpkg.com/@jspsych/plugin-survey@2.1.0",
  "https://unpkg.com/@jspsych/plugin-survey-html-form@2.1.0",
  "https://unpkg.com/@jspsych/plugin-survey-likert@2.1.0",
  "https://unpkg.com/@jspsych/plugin-survey-multi-choice@2.1.0",
  "https://unpkg.com/@jspsych/plugin-survey-multi-select@2.1.0",
  "https://unpkg.com/@jspsych/plugin-survey-text@2.1.0",
  "https://unpkg.com/@jspsych/plugin-video-button-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-video-keyboard-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-video-slider-response@2.1.0",
  "https://unpkg.com/@jspsych/plugin-virtual-chinrest@3.1.0",
  "https://unpkg.com/@jspsych/plugin-visual-search-circle@2.2.0",
  "https://unpkg.com/@jspsych/plugin-webgazer-calibrate@2.1.0",
  "https://unpkg.com/@jspsych/plugin-webgazer-init-camera@2.1.0",
  "https://unpkg.com/@jspsych/plugin-webgazer-validate@2.1.0",
];

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

function resolveFieldType(paramType) {
  const arrayMatch = paramType.match(/^array_(.+)$/);
  if (arrayMatch) {
    const baseType = arrayMatch[1];
    const baseResolved = typeMap[baseType] || baseType;
    return `${baseResolved}_array`;
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
          result += `\${${expressions[i]}}`;
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
      if (valNode.name === "undefined") return "__undefined__";
      if (valNode.name === "true") return true;
      if (valNode.name === "false") return false;
      return valNode.name;
    case "UnaryExpression":
      if (valNode.operator === "void") return "__undefined__";
      const arg = parseValue(valNode.argument, content);
      switch (valNode.operator) {
        case "!":
          return !arg;
        case "-":
          return -arg;
        case "+":
          return +arg;
        default:
          return `[Unary: ${valNode.operator}]`;
      }
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      return content.slice(valNode.start, valNode.end).trim();
    case "MemberExpression":
      const full = flattenMemberExpression(valNode);
      const match = full.match(/ParameterType\.([A-Z_]+)/);
      if (match) {
        return typeMap[match[1].toLowerCase()] || match[1].toLowerCase();
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

async function extractInfoFromCdn() {
  await fs.mkdir(outputDir, { recursive: true });

  for (const url of pluginUrls) {
    const nameMatch = url.match(/@jspsych\/(plugin-[^@/]+)/);
    const pluginName = nameMatch
      ? nameMatch[1]
      : `unknown-plugin-${Date.now()}`;
    const versionMatch = url.match(/@([\d.]+)$/);
    const version = versionMatch ? versionMatch[1] : "unknown";

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const content = await response.text();

      let infoNode = null;
      let ast = parse(content, { ecmaVersion: "latest", sourceType: "module" });

      walk.simple(ast, {
        AssignmentExpression(node) {
          if (
            node.left.type === "MemberExpression" &&
            node.left.property.name === "info" &&
            node.right.type === "ObjectExpression"
          ) {
            infoNode = node.right;
          }
        },
        VariableDeclarator(node) {
          if (
            node.init?.type === "ObjectExpression" &&
            node.init.properties.some(
              (p) =>
                (p.key.name || p.key.value) === "parameters" &&
                p.value.type === "ObjectExpression"
            )
          ) {
            infoNode = node.init;
          }
        },
      });

      if (!infoNode) {
        console.warn(`⚠️ No info object found in ${pluginName} (${url})`);
        continue;
      }

      const info = reconstructObject(infoNode, content);
      info.name = pluginName.replace(/^plugin-/, "");
      info.version = version;

      if (info.parameters) {
        for (const param of Object.values(info.parameters)) {
          if ("default" in param && param.default === undefined)
            param.default = "__undefined__";

          if (param.array) {
            param.type = `array_${param.type}`;
            delete param.array;
          }

          param.type = resolveFieldType(param.type);

          if (
            param.type === "function" &&
            typeof param.default === "string" &&
            !param.default.includes("__undefined__")
          ) {
            // Ya está bien representado como string, no tocar
          } else if (param.type === "function" && param.default === undefined) {
            param.default = "__undefined__";
          }
        }
      }

      const outPath = path.join(outputDir, `${pluginName}.json`);
      await fs.writeFile(outPath, JSON.stringify(info, null, 2));
      console.log(`✅ Extracted info from: ${pluginName}`);
    } catch (err) {
      console.error(`❌ Failed on ${pluginName}: ${err.message}`);
    }
  }
}

extractInfoFromCdn();
