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
  const fullArgs = token ? ["--token", token, ...args] : [...args];
  const child = spawn(process.execPath, [getFirebaseCliPath(), ...fullArgs], {
    cwd,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", FORCE_COLOR: "0" },
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
      child.on("close", (code) => resolve({ code, error: null, output }));
    }),
  };
}

export function writeBackendEnvFile(apiDir, env) {
  const envPath = path.join(apiDir, "functions", ".env");
  let existing = {};
  if (fs.existsSync(envPath)) {
    existing = fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .reduce((acc, line) => {
        const [key, ...rest] = line.split("=");
        if (key) acc[key.trim()] = rest.join("=").trim();
        return acc;
      }, {});
  }
  const merged = { ...existing, ...env };
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
