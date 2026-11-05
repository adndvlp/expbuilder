export function findWorkspaceDocument(data, id) {
  const existing = data.trials.find((d) => d.experimentID === id);
  if (existing) return existing;
  if (!data.experiments.some((e) => e.experimentID === id)) return null;
  return {
    experimentID: id,
    entryItemId: null,
    trials: [],
    loops: [],
    timeline: [],
    authoringRevision: "empty",
  };
}
