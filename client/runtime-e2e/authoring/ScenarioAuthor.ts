import {
  createScopedLoop,
  createScopedTrial,
} from "../../src/pages/ExperimentBuilder/components/Canvas/actions";
import type { Trial } from "../../src/pages/ExperimentBuilder/components/ConfigurationPanel/types";
import {
  commitLoopBranchIntent,
  isBranchTargetFromUserContext,
  saveBranchingIntent,
  saveConditionalLoopIntent,
  saveParamsOverrideIntent,
  selectLoopBranchLevel,
  startLoopBranchIntent,
} from "../../src/pages/ExperimentBuilder/modules/experiment-authoring/intents";
import { itemIdKey } from "../../src/pages/ExperimentBuilder/utils/branchGraphUtils";
import { addScenarioScopedBranch } from "./addScenarioScopedBranch";
import { compileScenarioArtifact } from "./compileScenarioArtifact";
import { moveScenarioItem } from "./moveScenarioItem";
import {
  buildBranchingDraft,
  buildConditionalLoopDraft,
  buildParamsOverrideDraft,
} from "./scenarioIntentDrafts";
import type {
  BranchConditionIntent,
  LoopConditionIntent,
  ParamsOverrideConditionIntent,
  RepeatConditionIntent,
} from "./scenarioIntentDrafts";
import {
  configureScenarioButtonTrial,
  configureScenarioDynamicButtonTrial,
} from "./scenarioTrialConfiguration";
import { ScenarioAuthoringSession } from "./ScenarioAuthoringSession";

export class ScenarioAuthor {
  readonly session: ScenarioAuthoringSession;
  readonly aliases = new Map<string, string | number>();

  constructor(readonly apiBaseUrl: string) {
    this.session = new ScenarioAuthoringSession(apiBaseUrl);
  }

  get client() {
    return this.session.client;
  }

  get experimentId() {
    return this.session.experimentId;
  }

  async createExperiment(name: string) {
    this.aliases.clear();
    return this.session.createExperiment(name);
  }

  id(alias: string) {
    const id = this.aliases.get(alias);
    if (id === undefined) throw new Error(`Unknown scenario alias: ${alias}`);
    return id;
  }

  async createTrial(alias: string) {
    const dependencies = this.dependencies();
    const trial = await createScopedTrial({
      scope: { kind: "root", items: this.session.graph.root.items },
      dependencies,
      trialType: "Trial",
    });
    if (!trial) throw new Error(`Could not create trial ${alias}`);
    const saved = await dependencies.updateTrial(trial.id, { name: alias });
    if (!saved) throw new Error(`Could not name trial ${alias}`);
    this.aliases.set(alias, saved.id);
    return saved;
  }

  async createLoop(alias: string, childAliases: string[]) {
    const dependencies = this.dependencies();
    const loop = await createScopedLoop({
      scope: { kind: "root", items: this.session.graph.root.items },
      dependencies,
      itemIds: childAliases.map((child) => this.id(child)),
    });
    if (!loop) throw new Error(`Could not create loop ${alias}`);
    const saved = await dependencies.updateLoop(loop.id, { name: alias });
    if (!saved) throw new Error(`Could not name loop ${alias}`);
    this.aliases.set(alias, saved.id);
    return saved;
  }

  private dependencies() {
    return this.session.canvasDependencies();
  }

  async addRootBranch(sourceAlias: string, targetAlias: string) {
    const saved = await addScenarioScopedBranch({
      sourceId: this.id(sourceAlias),
      targetName: targetAlias,
      dependencies: this.dependencies(),
      scope: { kind: "root", items: this.session.graph.root.items },
    });
    this.aliases.set(targetAlias, saved.id);
    return saved;
  }

  async addScopedBranch(sourceAlias: string, targetAlias: string, loopAlias: string) {
    const loopId = this.id(loopAlias);
    const saved = await addScenarioScopedBranch({
      sourceId: this.id(sourceAlias),
      targetName: targetAlias,
      dependencies: this.dependencies(),
      scope: {
        kind: "loop",
        loopId,
        items: this.session.graph.scopes[String(loopId)]?.items ?? [],
        rootItems: this.session.graph.root.items,
      },
    });
    this.aliases.set(targetAlias, saved.id);
    return saved;
  }

  async addLoopExitBranch(
    sourceAlias: string,
    targetAlias: string,
    targetScopeAlias: string | null = null,
    placement: "parallel" | "sequential" = "parallel",
  ) {
    const dependencies = this.session.loopBranchDependencies();
    const intent = await startLoopBranchIntent({
      experimentId: this.experimentId,
      sourceTrialId: this.id(sourceAlias),
      dependencies,
    });
    const targetScopeId = targetScopeAlias === null
      ? null
      : String(this.id(targetScopeAlias));
    const selection = selectLoopBranchLevel(intent, targetScopeId);
    if (!selection) {
      throw new Error(
        `Scope ${targetScopeAlias ?? "root"} is not available from ${sourceAlias}`,
      );
    }
    const result = await commitLoopBranchIntent({
      intent,
      selection,
      placement,
      dependencies,
    });
    const saved = await this.dependencies().updateTrial(result.trial.id, {
      name: targetAlias,
    });
    if (!saved) throw new Error(`Could not name loop branch ${targetAlias}`);
    this.aliases.set(targetAlias, saved.id);
    return saved;
  }

  async moveAfter(
    itemAlias: string,
    destinationAlias: string,
    scopeAlias: string | null = null,
  ) {
    return moveScenarioItem({
      client: this.client,
      dependencies: this.dependencies(),
      experimentId: this.experimentId,
      itemId: this.id(itemAlias),
      destinationId: this.id(destinationAlias),
      scopeId: scopeAlias === null ? null : this.id(scopeAlias),
    });
  }

  async configureButtonTrial(
    alias: string,
    updates: Partial<Trial> = {},
    choices: string[] = ["Continue"],
  ) {
    return configureScenarioButtonTrial(
      this.dependencies(),
      this.id(alias),
      alias,
      updates,
      choices,
    );
  }

  async configureButtonTrials(aliases: string[]) {
    for (const alias of aliases) {
      await this.configureButtonTrial(alias);
    }
  }

  async configureDynamicButtonTrial(alias: string) {
    return configureScenarioDynamicButtonTrial(
      this.dependencies(),
      this.id(alias),
    );
  }

  async configureBranchConditions(
    sourceAlias: string,
    intents: BranchConditionIntent[],
  ) {
    return this.saveRoutingConditions(sourceAlias, intents);
  }

  async configureParamsOverride(
    targetAlias: string,
    intents: ParamsOverrideConditionIntent[],
  ) {
    const conditions = buildParamsOverrideDraft(
      intents,
      (alias) => this.id(alias),
    );
    return saveParamsOverrideIntent({
      trialId: this.id(targetAlias),
      conditions,
      updateTrial: this.dependencies().updateTrial,
    });
  }

  async configureRepeatConditions(
    sourceAlias: string,
    intents: RepeatConditionIntent[],
  ) {
    return this.saveRoutingConditions(sourceAlias, intents);
  }

  async configureConditionalLoop(
    loopAlias: string,
    intents: LoopConditionIntent[],
  ) {
    const conditions = buildConditionalLoopDraft(
      intents,
      (alias) => this.id(alias),
    );
    return saveConditionalLoopIntent({
      loopId: this.id(loopAlias),
      conditions,
      updateLoop: this.dependencies().updateLoop,
    });
  }

  private async saveRoutingConditions(
    sourceAlias: string,
    intents: Array<BranchConditionIntent | RepeatConditionIntent>,
  ) {
    const source = await this.client.getTrial(
      this.experimentId,
      this.id(sourceAlias),
    );
    const graph = this.session.graph;
    const scopeTimeline = source.parentLoopId
      ? graph.scopes[String(source.parentLoopId)]?.items ?? []
      : graph.root.items;
    const topLevelLoopTrialIds = new Set(
      graph.root.items
        .filter((item) => item.type === "loop")
        .flatMap((item) => item.trials ?? [])
        .map((id) => itemIdKey(id)),
    );
    const conditions = buildBranchingDraft(
      intents,
      (alias) => this.id(alias),
    );

    return saveBranchingIntent({
      item: source,
      conditions,
      isBranchTarget: (targetId) =>
        isBranchTargetFromUserContext({
          selectedItem: source,
          targetId,
          scopeTimeline,
          topLevelLoopTrialIds,
        }),
      dependencies: this.dependencies(),
    });
  }

  async assertHealthyGraph() {
    const graph = await this.session.refreshGraph();
    if (graph.diagnostics.length > 0) {
      throw new Error(`Invalid authored graph: ${JSON.stringify(graph.diagnostics)}`);
    }
    return graph;
  }

  async compileAndBuild() {
    await this.assertHealthyGraph();
    return compileScenarioArtifact({
      apiBaseUrl: this.apiBaseUrl,
      client: this.client,
      experimentId: this.experimentId,
    });
  }
}
