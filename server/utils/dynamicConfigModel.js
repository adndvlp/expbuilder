const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isDynamic = trial => ["plugin-dynamic", "DynamicPlugin"].includes(trial?.plugin);

function userParameters(mapping) {
  if (!isRecord(mapping)) return mapping;
  const entries = Object.entries(mapping).filter(([key]) => !key.startsWith("__"));
  return entries.length === Object.keys(mapping).length ? mapping : Object.fromEntries(entries);
}

function conditionParameters(conditions, key) {
  if (!Array.isArray(conditions)) return conditions;
  let changed = false;
  const result = conditions.map(condition => {
    if (!isRecord(condition) || !Object.hasOwn(condition, key)) return condition;
    const mapping = userParameters(condition[key]);
    if (mapping === condition[key]) return condition;
    changed = true;
    return { ...condition, [key]: mapping };
  });
  return changed ? result : conditions;
}

/** Keep runtime-owned metadata out of the built-in plugin's user parameter maps. */
export function normalizeDynamicTrial(trial) {
  if (!isRecord(trial) || !isDynamic(trial)) return trial;
  const fields = {
    columnMapping: userParameters(trial.columnMapping),
    paramsOverride: conditionParameters(trial.paramsOverride, "paramsToOverride"),
    branchConditions: conditionParameters(trial.branchConditions, "customParameters"),
  };
  const changed = Object.entries(fields).filter(([key, value]) => value !== trial[key]);
  return changed.length ? { ...trial, ...Object.fromEntries(changed) } : trial;
}

function normalizeDynamicDocument(document) {
  if (!isRecord(document) || !Array.isArray(document.trials)) return document;
  const trials = document.trials.map(normalizeDynamicTrial);
  return trials.some((trial, index) => trial !== document.trials[index])
    ? { ...document, trials }
    : document;
}

function invalidateAutomaticCode(config) {
  if (!isRecord(config) || config.isDevMode || !isRecord(config.data)) return config;
  const code = config.data.generatedCode;
  if (typeof code !== "string" || code === "") return config;
  return { ...config, data: { ...config.data, generatedCode: "" } };
}

/**
 * TEMPORARY: cleanup of tester databases; retire before the release for users.
 * Remove with its startup hook and migration-only tests: docs/temporary-migrations.md.
 * Called on a freshly read database while its existing write lock is held.
 */
export function normalizeDynamicDatabase(data) {
  if (!isRecord(data) || !Array.isArray(data.trials)) return data;
  const changedIds = new Set();
  const trials = data.trials.map(document => {
    const normalized = normalizeDynamicDocument(document);
    if (normalized !== document) changedIds.add(document.experimentID);
    return normalized;
  });
  if (changedIds.size === 0) return data;
  const result = { ...data, trials };
  if (Array.isArray(data.configs)) {
    result.configs = data.configs.map(config => changedIds.has(config?.experimentID)
      ? invalidateAutomaticCode(config)
      : config);
  }
  return result;
}

/** Restored automatic programs are rebuilt by the current generator. */
export function normalizeImportedExperiment(payload) {
  if (!isRecord(payload)) return payload;
  const trials = normalizeDynamicDocument(payload.trials);
  const config = invalidateAutomaticCode(payload.config);
  if (trials === payload.trials && config === payload.config) return payload;
  return { ...payload, ...(trials !== payload.trials ? { trials } : {}),
    ...(config !== payload.config ? { config } : {}) };
}
