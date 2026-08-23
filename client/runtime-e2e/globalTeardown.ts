import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export default async function globalTeardown() {
  const dbRoot = process.env.RUNTIME_DB_ROOT;
  if (!dbRoot) return;
  const resolved = path.resolve(dbRoot);
  const safeParent = path.resolve(os.tmpdir());
  const safeName = path.basename(resolved).startsWith("expbuilder-runtime-");
  if (path.dirname(resolved) !== safeParent || !safeName) return;
  await fs.rm(resolved, { recursive: true, force: true });
}
