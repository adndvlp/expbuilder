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

function parseDefaultValue(defaultValue, block) {
  if (defaultValue === "void 0" || defaultValue === "undefined") {
    return undefined;
  }
  if (defaultValue === "null") return null;
  if (defaultValue === "true") return true;
  if (defaultValue === "false") return false;
  if (defaultValue.match(/^["'].*["']$/)) return defaultValue.slice(1, -1);
  if (defaultValue.match(/^\d+$/)) return parseInt(defaultValue);
  if (defaultValue.match(/^\d+\.\d+$/)) return parseFloat(defaultValue);

  if (defaultValue.startsWith("[") && defaultValue.endsWith("]")) {
    try {
      return JSON.parse(defaultValue.replace(/'/g, '"'));
    } catch {
      return defaultValue;
    }
  }

  if (defaultValue.startsWith("{") && defaultValue.includes("}")) {
    const objMatch = block.match(/default:\s*(\{[\s\S]*?\})/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[1].replace(/'/g, '"'));
      } catch {
        return objMatch[1];
      }
    }
  }

  return defaultValue;
}

export function extractParameters(paramsContent) {
  const parameters = {};
  const paramBlocks = paramsContent.split(/\n\s{4}(?=[a-zA-Z_])/);

  for (const block of paramBlocks) {
    if (!block.trim()) continue;

    const nameMatch = block.match(/^([a-zA-Z_][a-zA-Z0-9_]*):/);
    if (!nameMatch) continue;

    const paramName = nameMatch[1];
    const param = {};

    const typeMatch = block.match(/type:\s*ParameterType\.([A-Z_]+)/);
    if (typeMatch) {
      param.type = typeMap[typeMatch[1]] || typeMatch[1].toLowerCase();
    }

    const arrayMatch = block.match(/array:\s*(true|false)/);
    if (arrayMatch && arrayMatch[1] === "true") {
      param.type = `${param.type}_array`;
    }

    const defaultMatch = block.match(/default:\s*(.+?)(?:,\n|$)/s);
    if (defaultMatch) {
      param.default = parseDefaultValue(defaultMatch[1].trim(), block);
    }

    const prettyMatch = block.match(/pretty_name:\s*["']([^"']+)["']/);
    if (prettyMatch) param.pretty_name = prettyMatch[1];

    const descMatch = block.match(/description:\s*["']([^"']+)["']/);
    if (descMatch) param.description = descMatch[1];

    parameters[paramName] = param;
  }

  return parameters;
}

export function extractInfoObject(content) {
  let infoMatch = content.match(
    /const\s+info\s*=\s*<const>\s*\{([\s\S]*?)\n\};/,
  );

  if (!infoMatch) {
    infoMatch = content.match(/const\s+info\s*=\s*\{([\s\S]*?)\n\};/);
  }

  if (!infoMatch) return null;

  const infoContent = infoMatch[1];
  const info = {};

  const nameMatch = infoContent.match(/name:\s*["']([^"']+)["']/);
  if (nameMatch) info.name = nameMatch[1];

  let versionMatch = content.match(
    /(?:const|let|var)\s+version\s*=\s*["']([^"']+)["']/,
  );
  if (!versionMatch) {
    versionMatch = infoContent.match(/version:\s*version/);
    if (versionMatch) {
      const importMatch = content.match(
        /import\s*\{[^}]*version[^}]*\}\s*from\s*["']([^"']+)["']/,
      );
      if (importMatch) info.version = "imported";
    }
  } else {
    info.version = versionMatch[1];
  }

  const parametersMatch = infoContent.match(
    /parameters:\s*\{([\s\S]*?)\n\s{2}\},/,
  );
  if (parametersMatch) {
    info.parameters = extractParameters(parametersMatch[1]);
  }

  const dataMatch = infoContent.match(/data:\s*\{([\s\S]*?)\n\s{2}\},/);
  if (dataMatch) {
    info.data = extractParameters(dataMatch[1]);
  }

  return info;
}
