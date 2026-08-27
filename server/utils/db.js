import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { __dirname, __filename } from "../utils/paths.js";
import path from "path";
import fs from "fs";

// Usar ruta de usuario para todos los recursos de escritura si está definida
/* istanbul ignore next -- DB_ROOT override and DB_PATH variants are covered; default app path is startup configuration. */
const userDataRoot = process.env.DB_ROOT || __dirname;

// Base de datos
let dbPath, dbDir;
if (process.env.DB_PATH) {
  dbPath = process.env.DB_PATH;
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.join(userDataRoot, dbPath);
  }
  dbDir = path.dirname(dbPath);
} else {
  dbPath = path.join(userDataRoot, "database", "db.json");
  dbDir = path.dirname(dbPath);
}
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const adapter = new JSONFile(dbPath);
export const db = new Low(adapter, {});
let dbAccessQueue = Promise.resolve();

export function ensureDbData() {
  db.data ||= {};
  db.data.experiments ||= [];
  db.data.trials ||= [];
  db.data.configs ||= [];
  db.data.pluginConfigs ||= [];
  db.data.sessionResults ||= [];
  db.data.participantFiles ||= [];
  db.data.sessionCounters ||= {};
  db.data.mutationReceipts ||= [];
  // Chat agent — intentionally excluded from experiment export/import and factory reset
  db.data.chat ||= {
    apiKeys: {},
    activeProvider: "anthropic",
    activeModel: "claude-sonnet-4-6",
    conversations: [],
  };
}

function enqueueDbAccess(operation) {
  const queued = dbAccessQueue.then(operation);
  dbAccessQueue = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

export function withDbRead(reader) {
  return enqueueDbAccess(async () => {
    await db.read();
    ensureDbData();
    return reader(db.data);
  });
}

export function withDbMutation(mutator) {
  return enqueueDbAccess(async () => {
    await db.read();
    ensureDbData();
    const previous = db.data;
    const candidate = structuredClone(previous);
    const result = await mutator(candidate);
    db.data = candidate;
    try {
      await db.write();
      return result;
    } catch (error) {
      db.data = previous;
      throw error;
    }
  });
}

// Exportar userDataRoot, dbPath y dbDir para usar en otros módulos
export { userDataRoot, dbPath, dbDir };
