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

export const STAGED_API_VERSION_FILENAME = ".staged-version";

const tryReadText = (filePath) => {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  } catch {
    return null;
  }
};

/**
 * Resolves a writable api dir for backend operations (firebase CLI cwd and
 * functions/.env writes).
 *
 * In production the bundled `api` dir lives inside the app package, which is
 * read-only on macOS (and doubly so under AppTranslocation when the app runs
 * outside /Applications) — writing functions/.env there fails with EROFS.
 * So production stages a copy under `userDataDir` and operates there:
 * the copy is (re)made when the app version changes, node_modules/.git are
 * excluded (deploys work without bundled node_modules by design), and a
 * previously saved functions/.env is preserved across re-stages.
 *
 * Dev and BACKEND_API_DIR override keep the legacy direct behavior.
 */
export function ensureWritableApiDir({
  isProduction,
  userDataDir,
  appVersion,
}) {
  if (process.env.BACKEND_API_DIR) {
    return process.env.BACKEND_API_DIR;
  }
  if (!isProduction) {
    return path.join(process.cwd(), "api");
  }
  const sourceDir = path.join(process.resourcesPath ?? process.cwd(), "api");
  if (!userDataDir) {
    throw new Error("userDataDir is required to stage the backend api dir");
  }
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Bundled backend not found at ${sourceDir}`);
  }
  const stagedDir = path.join(userDataDir, "api");
  const stampPath = path.join(stagedDir, STAGED_API_VERSION_FILENAME);
  const stagedVersion = (tryReadText(stampPath) ?? "").trim() || null;
  if (stagedVersion !== String(appVersion ?? "")) {
    // Preserve credentials saved by previous runs before refreshing.
    const stagedEnvPath = path.join(stagedDir, "functions", ".env");
    const preservedEnv = tryReadText(stagedEnvPath);
    fs.rmSync(stagedDir, { recursive: true, force: true });
    fs.mkdirSync(stagedDir, { recursive: true });
    fs.cpSync(sourceDir, stagedDir, {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(sourceDir, src);
        if (!rel) return true;
        const top = rel.split(path.sep)[0];
        return top !== "node_modules" && top !== ".git";
      },
    });
    if (preservedEnv !== null) {
      fs.mkdirSync(path.dirname(stagedEnvPath), { recursive: true });
      fs.writeFileSync(stagedEnvPath, preservedEnv, "utf8");
    }
    fs.writeFileSync(stampPath, String(appVersion ?? ""), "utf8");
  }
  return stagedDir;
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
