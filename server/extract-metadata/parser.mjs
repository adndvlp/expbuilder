import { parse } from "acorn";
import * as walk from "acorn-walk";

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

  if (Object.values(typeMap).includes(paramType)) {
    return paramType;
  }
  return typeMap[paramType] || paramType;
}

function flattenMemberExpression(node, content) {
  if (node.type !== "MemberExpression") return "";
  const object =
    node.object.type === "Identifier"
      ? node.object.name
      : flattenMemberExpression(node.object, content);
  const property =
    node.property.type === "Identifier"
      ? node.property.name
      : `[${parseValue(node.property, content)}]`;
  return `${object}.${property}`;
}

function parseValue(valNode, content) {
  if (!valNode) return null;

  switch (valNode.type) {
    case "TemplateLiteral": {
      const quasis = valNode.quasis.map((q) => q.value.cooked);
      const expressions = valNode.expressions.map((expr) =>
        parseValue(expr, content),
      );
      let result = "";
      for (let i = 0; i < quasis.length; i++) {
        result += quasis[i];
        if (i < expressions.length) result += "${" + expressions[i] + "}";
      }
      return `\`${result}\``;
    }

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

    case "UnaryExpression": {
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
    }

    case "FunctionExpression":
    case "ArrowFunctionExpression":
      return content.slice(valNode.start, valNode.end).trim();

    case "MemberExpression": {
      const full = flattenMemberExpression(valNode, content);
      const match = full.match(/(?:jspsych\.)?ParameterType\.([A-Z_]+)/);
      if (match) {
        const typeKey = match[1].toLowerCase();
        return typeMap[typeKey] || typeKey;
      }
      return `[MemberExpression: ${full}]`;
    }

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

function parseAst(content) {
  try {
    return parse(content, { ecmaVersion: "latest", sourceType: "script" });
  } catch (parseError) {
    try {
      return parse(content, { ecmaVersion: "latest", sourceType: "module" });
    } catch {
      throw new Error(`AST parsing failed: ${parseError.message}`);
    }
  }
}

function findInfoNode(ast) {
  let infoNode = null;

  walk.simple(ast, {
    AssignmentExpression(node) {
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

  return infoNode;
}

function normalizeParameters(info) {
  if (!info.parameters) return;

  for (const param of Object.values(info.parameters)) {
    if ("default" in param && param.default === undefined) {
      param.default = "__undefined__";
    }

    if (param.array) {
      param.type = `array_${param.type}`;
      delete param.array;
    }

    param.type = resolveFieldType(param.type);

    if (
      param.type === "function" &&
      (param.default === "void 0" || param.default === "__undefined__")
    ) {
      param.default = undefined;
    }

    if (param.type === "function" && typeof param.default === "function") {
      param.default = param.default.toString();
    }
  }
}

export function extractPluginInfo(content, pluginName) {
  const versionMatch =
    content.match(/var version\s*=\s*["']([^"']+)["']/) ||
    content.match(/const version\s*=\s*["']([^"']+)["']/);
  const versionString = versionMatch ? versionMatch[1] : "unknown_version";
  const ast = parseAst(content);
  const infoNode = findInfoNode(ast);

  if (!infoNode) return null;

  const info = reconstructObject(infoNode, content);
  if (!info.name) info.name = pluginName;
  if (!info.version) info.version = versionString;
  normalizeParameters(info);

  return { info, versionString };
}
