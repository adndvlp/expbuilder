import { db, initDb } from "./database/lowdb";
import { ensureDbData } from "./database/ensureDbData";

export interface Plugin {
  name: string;
  scripTag: string;
  pluginCode: string;
  index: number;
}

export interface PluginConfigDoc {
  plugins: Plugin[];
  config: any;
}

// Obtener todos los plugins custom/subidos
export async function getPlugins(): Promise<Plugin[]> {
  await initDb();
  await db.read();
  ensureDbData(db);
  const pluginConfig = db.data.pluginConfigs[0];
  return pluginConfig ? pluginConfig.plugins : [];
}

// Guardar (crear o actualizar) un plugin por índice
export async function savePlugin(
  index: number,
  plugin: Omit<Plugin, "index">
): Promise<Plugin> {
  await initDb();
  await db.read();
  ensureDbData(db);
  let pluginConfig = db.data.pluginConfigs[0];
  if (!pluginConfig) {
    pluginConfig = { plugins: [], config: {} };
    db.data.pluginConfigs.push(pluginConfig);
  }
  const existingIndex = pluginConfig.plugins.findIndex(
    (p: Plugin) => p.index === index
  );
  const newPlugin: Plugin = { ...plugin, index };
  if (existingIndex >= 0) {
    pluginConfig.plugins[existingIndex] = newPlugin;
  } else {
    pluginConfig.plugins.push(newPlugin);
  }
  await db.write();
  return newPlugin;
}

// Eliminar un plugin por índice
export async function deletePlugin(index: number): Promise<boolean> {
  await initDb();
  await db.read();
  ensureDbData(db);
  const pluginConfig = db.data.pluginConfigs[0];
  if (!pluginConfig) return false;
  const before = pluginConfig.plugins.length;
  pluginConfig.plugins = pluginConfig.plugins.filter(
    (p: Plugin) => p.index !== index
  );
  await db.write();
  return pluginConfig.plugins.length < before;
}
