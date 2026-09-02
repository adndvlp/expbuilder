import type { TimelineItem } from "../../pages/ExperimentBuilder/contexts/TrialsContext";
import type { Loop, Trial } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type {
  ExperimentGraphSnapshot,
  GraphScopeView,
} from "../../pages/ExperimentBuilder/modules/experiment-graph/types";

export function timelineTrial(
  overrides: Partial<TimelineItem> & Pick<TimelineItem, "id">,
): TimelineItem {
  return {
    type: "trial",
    name: `Trial ${overrides.id}`,
    branches: [],
    ...overrides,
  };
}

export function timelineLoop(
  overrides: Partial<TimelineItem> & Pick<TimelineItem, "id">,
): TimelineItem {
  return {
    type: "loop",
    name: `Loop ${overrides.id}`,
    branches: [],
    trials: [],
    ...overrides,
  };
}

export function trial(overrides: Partial<Trial> = {}): Trial {
  const id = overrides.id ?? 1;

  return {
    id,
    type: "trial",
    name: `Trial ${id}`,
    plugin: "html-keyboard-response",
    parameters: {},
    trialCode: "",
    branches: [],
    ...overrides,
  };
}

export function trialDraft(overrides: Partial<Omit<Trial, "id">> = {}): Omit<Trial, "id"> {
  return {
    type: "trial",
    name: "Draft Trial",
    plugin: "html-keyboard-response",
    parameters: {},
    trialCode: "",
    branches: [],
    ...overrides,
  };
}

export function loop(overrides: Partial<Loop> = {}): Loop {
  const id = overrides.id ?? "loop-1";

  return {
    id,
    name: `Loop ${id}`,
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    orderColumns: [],
    categories: false,
    categoryColumn: "",
    categoryData: [],
    trials: [],
    code: "",
    branches: [],
    ...overrides,
  };
}

export function loopDraft(overrides: Partial<Omit<Loop, "id">> = {}): Omit<Loop, "id"> {
  return {
    name: "Draft Loop",
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    orderColumns: [],
    categories: false,
    categoryColumn: "",
    categoryData: [],
    trials: [],
    code: "",
    branches: [],
    ...overrides,
  };
}

export function okJson(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

export function notOkJson(body: unknown = {}): Response {
  return {
    ok: false,
    json: async () => body,
  } as Response;
}

export function graphSnapshot(
  rootItems: TimelineItem[] = [],
  scopes: Record<string, GraphScopeView> = {},
  edges: ExperimentGraphSnapshot["edges"] = [],
): ExperimentGraphSnapshot {
  return {
    revision: "test-revision",
    root: { scopeId: null, parentScopeId: null, items: rootItems },
    scopes,
    edges,
    diagnostics: [],
  };
}

export function graphJson(
  rootItems: TimelineItem[] = [],
  scopes: Record<string, GraphScopeView> = {},
  edges: ExperimentGraphSnapshot["edges"] = [],
): Response {
  return okJson({ graph: graphSnapshot(rootItems, scopes, edges) });
}

export function mutationJson(
  body: Record<string, unknown>,
  rootItems: TimelineItem[] = [],
  scopes: Record<string, GraphScopeView> = {},
): Response {
  return okJson({ ...body, graph: graphSnapshot(rootItems, scopes) });
}
