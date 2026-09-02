import { addScopedBranchTrial } from "../../src/pages/ExperimentBuilder/components/Canvas/actions";

type ScopedBranchOptions = {
  dependencies: Parameters<typeof addScopedBranchTrial>[0]["dependencies"];
  scope: Parameters<typeof addScopedBranchTrial>[0]["scope"];
  sourceId: string | number;
  targetName: string;
};

export async function addScenarioScopedBranch(options: ScopedBranchOptions) {
  const trial = await addScopedBranchTrial({
    parentId: options.sourceId,
    scope: options.scope,
    dependencies: options.dependencies,
  });
  if (!trial) throw new Error(`Could not branch from ${options.sourceId}`);
  const saved = await options.dependencies.updateTrial(trial.id, {
    name: options.targetName,
  });
  if (!saved) throw new Error(`Could not name branch ${options.targetName}`);
  return saved;
}
