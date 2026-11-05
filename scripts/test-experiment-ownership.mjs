import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import { nodeCompatBin } from "../__tests__/helpers/cloud-env.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "expbuilder-m01-emulator-"));
const baseline = process.argv.includes("--baseline-rules");
const compatBin = nodeCompatBin();
const node = compatBin ? join(compatBin, "node") : process.execPath;
const port = 18080;
try {
  const rules = baseline
    ? execFileSync("git", ["show", "HEAD:api/firestore.rules"], { cwd: root })
    : readFileSync(resolve(root, "api/firestore.rules"));
  writeFileSync(join(directory, "firestore.rules"), rules);
  writeFileSync(
    join(directory, "firebase.json"),
    JSON.stringify({
      firestore: { rules: "firestore.rules" },
      emulators: {
        firestore: { host: "127.0.0.1", port },
        ui: { enabled: false },
        hub: { host: "127.0.0.1", port: 14400 },
        logging: { host: "127.0.0.1", port: 14500 },
      },
    }),
  );
  const quote = (value) => "'" + String(value).replaceAll("'", "'\\''") + "'";
  const command = [
    node,
    "--experimental-vm-modules",
    resolve(root, "api/functions/node_modules/jest/bin/jest.js"),
    "--config",
    resolve(root, "api/functions/jest.emulator.config.mjs"),
    "--runTestsByPath",
    resolve(
      root,
      "api/functions/__tests__/experiment/ownership-emulator.test.js",
    ),
    "--runInBand",
    "--silent",
  ]
    .map(quote)
    .join(" ");
  const result = spawnSync(
    node,
    [
      resolve(root, "node_modules/firebase-tools/lib/bin/firebase.js"),
      "emulators:exec",
      "--config",
      join(directory, "firebase.json"),
      "--project",
      "demo-expbuilder-m01",
      "--only",
      "firestore",
      command,
    ],
    {
      cwd: directory,
      stdio: "inherit",
      env: {
        ...process.env,
        ...(compatBin ? { PATH: `${compatBin}:${process.env.PATH}` } : {}),
        FIREBASE_CONFIG: JSON.stringify({ projectId: "demo-expbuilder-m01" }),
        RUN_M01_FIRESTORE_TESTS: "1",
        GCLOUD_PROJECT: "demo-expbuilder-m01",
        GOOGLE_CLOUD_PROJECT: "demo-expbuilder-m01",
        FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}`,
      },
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
