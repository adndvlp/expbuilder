import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { __dirname, __filename } from "../utils/paths.js";
import path from "path";
import fs from "fs";

// Usar ruta de usuario para todos los recursos de escritura si está definida
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

export function ensureDbData() {
  db.data ||= {};
  db.data.experiments ||= [];
  db.data.trials ||= [];
  db.data.configs ||= [];
  db.data.pluginConfigs ||= [];
  db.data.sessionResults ||= [];
}

// Exportar userDataRoot, dbPath y dbDir para usar en otros módulos
export { userDataRoot, dbPath, dbDir };
