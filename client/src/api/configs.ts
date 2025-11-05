import { db, initDb } from "./database/lowdb";
import { ensureDbData } from "./database/ensureDbData";

export interface ConfigDoc {
  experimentID: string;
  data: any;
  isDevMode?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Obtener la configuración de un experimento
export async function getConfigByExperimentID(
  experimentID: string
): Promise<{ config: any; isDevMode: boolean } | null> {
  await initDb();
  await db.read();
  ensureDbData(db);
  const configDoc = db.data.configs.find(
    (c: any) => c.experimentID === experimentID
  );
  if (!configDoc) return null;
  return { config: configDoc.data, isDevMode: !!configDoc.isDevMode };
}

// Guardar (crear o actualizar) la configuración de un experimento
export async function saveConfig(
  experimentID: string,
  config: any,
  isDevMode: boolean = false
): Promise<ConfigDoc> {
  await initDb();
  await db.read();
  ensureDbData(db);
  const now = new Date().toISOString();
  const existingIndex = db.data.configs.findIndex(
    (c: any) => c.experimentID === experimentID
  );
  const configDoc: ConfigDoc = {
    experimentID,
    data: config,
    isDevMode,
    createdAt: now,
    updatedAt: now,
  };
  if (existingIndex !== -1) {
    configDoc.createdAt = db.data.configs[existingIndex].createdAt;
    db.data.configs[existingIndex] = configDoc;
  } else {
    db.data.configs.push(configDoc);
  }
  await db.write();
  return configDoc;
}
