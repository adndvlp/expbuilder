import type { CanvasActionDependencies } from "../../src/pages/ExperimentBuilder/components/Canvas/actions/types";
import { createExperimentAuthoringClient } from "../../src/pages/ExperimentBuilder/modules/experiment-authoring/client";
import type { LoopBranchIntentDependencies } from "../../src/pages/ExperimentBuilder/modules/experiment-authoring/intents";
import type { ExperimentAuthoringClient } from "../../src/pages/ExperimentBuilder/modules/experiment-authoring/types";
import type { ExperimentGraphSnapshot } from "../../src/pages/ExperimentBuilder/modules/experiment-graph/types";

function emptyGraph(): ExperimentGraphSnapshot {
  return {
    revision: "not-persisted",
    root: { scopeId: null, parentScopeId: null, items: [] },
    scopes: {},
    edges: [],
    diagnostics: [],
  };
}

export class ScenarioAuthoringSession {
  readonly client: ExperimentAuthoringClient;
  experimentId = "";
  private snapshot = emptyGraph();

  constructor(
    apiBaseUrl: string,
    client: ExperimentAuthoringClient = createExperimentAuthoringClient({
      baseUrl: apiBaseUrl,
    }),
  ) {
    this.client = client;
  }

  get graph() {
    return this.snapshot;
  }

  async createExperiment(name: string) {
    const experiment = await this.client.createExperiment({ name });
    this.experimentId = experiment.experimentID;
    this.snapshot = emptyGraph();
    return experiment;
  }

  async refreshGraph() {
    this.snapshot = await this.client.getGraph(this.experimentId);
    return this.snapshot;
  }

  canvasDependencies(): CanvasActionDependencies {
    return {
      createTrial: async (trial) => {
        const result = await this.client.createTrial(this.experimentId, trial);
        this.snapshot = result.graph;
        return result.trial;
      },
      createLoop: async (loop) => {
        const result = await this.client.createLoop(this.experimentId, loop);
        this.snapshot = result.graph;
        return result.loop;
      },
      getTrial: (id) => this.client.getTrial(this.experimentId, id),
      getLoop: (id) => this.client.getLoop(this.experimentId, id),
      updateTrial: async (id, updates) => {
        const result = await this.client.updateTrial(
          this.experimentId,
          id,
          updates,
        );
        this.snapshot = result.graph;
        return result.trial;
      },
      updateLoop: async (id, updates) => {
        const result = await this.client.updateLoop(
          this.experimentId,
          id,
          updates,
        );
        this.snapshot = result.graph;
        return result.loop;
      },
      updateTrialField: async (id, field, value) => {
        const result = await this.client.updateTrial(this.experimentId, id, {
          [field]: value,
        });
        this.snapshot = result.graph;
        return true;
      },
      updateTimeline: async (timeline) => {
        const result = await this.client.updateTimeline(
          this.experimentId,
          timeline,
        );
        this.snapshot = result.graph;
        return true;
      },
    } as CanvasActionDependencies;
  }

  loopBranchDependencies(): LoopBranchIntentDependencies {
    return {
      loadLevels: (experimentId, sourceTrialId) =>
        this.client.loadLoopBranchLevels(experimentId, sourceTrialId),
      createBranch: async (
        experimentId,
        sourceTrialId,
        targetScopeId,
        mode,
      ) => {
        const result = await this.client.createLoopBranch(
          experimentId,
          sourceTrialId,
          targetScopeId,
          mode,
        );
        this.snapshot = result.graph;
        return result;
      },
    };
  }
}
