import { Low } from "lowdb";

export function ensureDbData(db: Low<any>) {
  db.data ||= {};
  db.data.experiments ||= [];
  db.data.trials ||= [];
  db.data.configs ||= [];
  db.data.pluginConfigs ||= [];
  db.data.sessionResults ||= [];
}
