import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { ensureDbData } from "./ensureDbData";

// Ajusta la ruta para que esté fuera del bundle React pero dentro de la app de Electron
const DB_OUTPUT_DIR = path.resolve(__dirname, "../../database");
const dbPath = path.join(DB_OUTPUT_DIR, "db.json");
const adapter = new JSONFile(dbPath);
export const db = new Low(adapter, {});

export async function initDb() {
  await db.read();
  ensureDbData(db);
  await db.write();
}
