import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export function getFirebaseCliPath() {
  try {
    return require.resolve("firebase-tools/lib/bin/firebase.js");
  } catch {
    return path.join(
      "node_modules",
      "firebase-tools",
      "lib",
      "bin",
      "firebase.js",
    );
  }
}

export function getApiDir(isProduction) {
  if (process.env.BACKEND_API_DIR) {
    return process.env.BACKEND_API_DIR;
  }
  if (isProduction) {
    return path.join(process.resourcesPath ?? process.cwd(), "api");
  }
  return path.join(process.cwd(), "api");
}

export function startFirebaseCommand({ args, token, cwd, onOutput }) {
  const fullArgs = [
    "--interactive",
    ...(token ? ["--token", token] : []),
    ...args,
  ];
  const child = spawn(process.execPath, [getFirebaseCliPath(), ...fullArgs], {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      FORCE_COLOR: "0",
      CI: "",
    },
  });

  let output = "";
  const emit = (stream, chunk) => {
    const text = chunk.toString();
    output += text;
    onOutput?.({ stream, text });
  };
  child.stdout?.on("data", (chunk) => emit("stdout", chunk));
  child.stderr?.on("data", (chunk) => emit("stderr", chunk));

  return {
    write: (text) => {
      if (!child.stdin?.writableEnded) {
        child.stdin?.write(text);
      }
    },
    kill: () => child.kill(),
    done: new Promise((resolve) => {
      child.on("error", (error) =>
        resolve({ code: null, error: error.message, output }),
      );
      child.on("close", (code) => {
        const extra = code === 0 ? "" : formatFirebaseDebugError(cwd);
        resolve({
          code,
          error: null,
          output: extra ? `${output}\n${extra}` : output,
        });
      });
    }),
  };
}

export function formatFirebaseDebugError(apiDir) {
  if (!apiDir) return "";
  const logPath = path.join(apiDir, "firebase-debug.log");
  if (!fs.existsSync(logPath)) return "";
  const text = fs.readFileSync(logPath, "utf8");
  const messages = [...text.matchAll(/Error:\s*(.+)/g)]
    .map((match) => match[1].trim())
    .filter((message) => message && message !== "An unexpected error has occurred.");
  const last = messages.at(-1);
  return last ? `Error: ${last}` : "";
}

const RESERVED_FUNCTIONS_ENV_PREFIXES = ["X_GOOGLE_", "FIREBASE_", "EXT_", "KIT_"];

export function isReservedFunctionsEnvKey(key) {
  const upper = String(key || "").toUpperCase();
  return RESERVED_FUNCTIONS_ENV_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

function parseEnvFile(contents) {
  return contents
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .reduce((acc, line) => {
      const [key, ...rest] = line.split("=");
      if (key) acc[key.trim()] = rest.join("=").trim();
      return acc;
    }, {});
}

function withoutReservedEnvKeys(env) {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => key && !isReservedFunctionsEnvKey(key)),
  );
}

export function writeBackendEnvFile(apiDir, env) {
  const envPath = path.join(apiDir, "functions", ".env");
  let existing = {};
  if (fs.existsSync(envPath)) {
    existing = parseEnvFile(fs.readFileSync(envPath, "utf8"));
  }
  const merged = withoutReservedEnvKeys({ ...existing, ...env });
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(
    envPath,
    Object.entries(merged)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
    "utf8",
  );
  return envPath;
}

export function readBackendSetupState(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function writeBackendSetupState(filePath, state) {
  fs.writeFileSync(filePath, JSON.stringify(state ?? {}, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  return filePath;
}
