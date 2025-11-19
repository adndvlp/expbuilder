import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { __dirname, __filename } from "../utils/paths.js";
import path from "path";
import fs from "fs";

const dbPath = path.join(__dirname, "database", "db.json");
const dbDir = path.dirname(dbPath);
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
