import { createHash } from "node:crypto";
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  open,
  rm,
  stat,
} from "node:fs/promises";
import { join, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const digest = (value) => createHash("sha256").update(value).digest("hex");
async function files(directory, skip = []) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const name = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(name, skip)));
    else if (entry.isFile()) result.push(name);
  }
  return result.sort();
}
async function hashes(directory) {
  return Object.fromEntries(
    await Promise.all(
      (await files(directory))
        .filter((file) => basename(file) !== ".build.json")
        .map(async (file) => [
          relative(directory, file).replaceAll("\\", "/"),
          digest(await readFile(file)),
        ]),
    ),
  );
}
async function fingerprint(root, source, compiler) {
  const inputs = (await files(source, ["dist", "type-tests"])).filter(
    (file) => file.endsWith(".ts") || file === join(source, "tsconfig.json"),
  );
  const hash = createHash("sha256");
  hash.update(await readFile(fileURLToPath(import.meta.url)));
  for (const file of inputs)
    hash.update(relative(source, file)).update(await readFile(file));
  hash.update(await readFile(join(dirname(compiler), "../package.json")));
  for (const name of ["package.json", "package-lock.json"]) {
    try {
      hash.update(await readFile(join(root, name)));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return hash.digest("hex");
}
async function fresh(output, sourceHash) {
  try {
    const saved = JSON.parse(
      await readFile(join(output, ".build.json"), "utf8"),
    );
    return (
      saved.sourceHash === sourceHash &&
      JSON.stringify(saved.outputs) === JSON.stringify(await hashes(output))
    );
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return false;
    throw error;
  }
}
async function acquire(file) {
  await mkdir(dirname(file), { recursive: true });
  const deadline = Date.now() + 120000;
  while (true) {
    try {
      const handle = await open(file, "wx");
      await handle.writeFile(String(process.pid));
      await handle.close();
      return () => rm(file, { force: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const owner = Number(await readFile(file, "utf8"));
        if (Number.isInteger(owner) && owner > 0) {
          try {
            process.kill(owner, 0);
          } catch (error) {
            if (error.code === "ESRCH") {
              await rm(file, { force: true });
              continue;
            }
          }
        } else if (Date.now() - (await stat(file)).mtimeMs > 10000) {
          await rm(file, { force: true });
          continue;
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (Date.now() > deadline)
        throw new Error("Timed out waiting for workspace compilation", {
          cause: error,
        });
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }
}
export async function buildWorkspace({
  root = repositoryRoot,
  compiler = join(root, "node_modules/typescript/bin/tsc"),
  force = false,
} = {}) {
  const source = join(root, "shared/experiment-workspace"),
    output = join(source, "dist");
  const release = await acquire(
    join(root, "node_modules/.cache/expbuilder/workspace-build.lock"),
  );
  try {
    const sourceHash = await fingerprint(root, source, compiler);
    if (!force && (await fresh(output, sourceHash))) return false;
    await rm(output, { recursive: true, force: true });
    console.log("Compiling shared workspace...");
    const code = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [compiler, "-p", join(source, "tsconfig.json")],
        { cwd: root, stdio: "inherit" },
      );
      let interrupted = false;
      const interrupt = (signal) => {
        interrupted = true;
        child.kill(signal);
      };
      const stop = () => interrupt("SIGINT"),
        terminate = () => interrupt("SIGTERM");
      process.once("SIGINT", stop);
      process.once("SIGTERM", terminate);
      const cleanup = () => {
        process.removeListener("SIGINT", stop);
        process.removeListener("SIGTERM", terminate);
      };
      child.on("error", (error) => {
        cleanup();
        reject(error);
      });
      child.on("exit", (code) => {
        cleanup();
        resolve(interrupted ? 1 : (code ?? 1));
      });
    });
    if (code !== 0) {
      await rm(output, { recursive: true, force: true });
      throw Error("Workspace compilation failed; consumers were not started");
    }
    await writeFile(
      join(output, ".build.json"),
      JSON.stringify({ sourceHash, outputs: await hashes(output) }),
    );
    return true;
  } finally {
    await release();
  }
}
