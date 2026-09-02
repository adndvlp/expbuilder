import { afterEach, vi } from "vitest";
import ExperimentBase from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ExperimentBase";
import PublicConfiguration from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/PublicConfiguration";
import { resumeCode } from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ResumeCode";

const hoistedMocks = vi.hoisted(() => ({
  generateAllCodes: vi.fn(),
  firestoreDoc: vi.fn(),
  firestoreGetDoc: vi.fn(),
  currentUser: { uid: "user-1" } as { uid: string } | null,
  experimentGraph: {
    revision: "test-revision",
    root: { scopeId: null, parentScopeId: null, items: [] },
    scopes: {},
    edges: [],
    diagnostics: [],
  },
  devMode: {
    isDevMode: false,
    code:
      "dev-code;" +
      "if (window.branchCustomParameters) { Object.entries(window.branchCustomParameters).forEach(() => {}); }",
    customInitJsPsychParams: { public: {} as Record<string, string> },
    customPreInitCode: { public: "" },
  },
}));

const generateAllCodesMock = hoistedMocks.generateAllCodes;

vi.mock(
  "../../../pages/ExperimentBuilder/utils/generateTrialLoopCodes",
  () => ({
    generateAllCodes: generateAllCodesMock,
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/modules/experiment-graph/api",
  () => ({
    loadExperimentGraph: vi.fn(async () => hoistedMocks.experimentGraph),
  }),
);

vi.mock("../../../pages/ExperimentBuilder/hooks/useDevMode", () => ({
  default: () => hoistedMocks.devMode,
}));

vi.mock("firebase/firestore", () => ({
  doc: hoistedMocks.firestoreDoc,
  getDoc: hoistedMocks.firestoreGetDoc,
}));

vi.mock("../../../lib/firebase", () => {
  const auth = {};
  Object.defineProperty(auth, "currentUser", {
    get: () => hoistedMocks.currentUser,
  });
  return { auth, db: {} };
});

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

function getResumeResolver() {
  const factory = new Function(
    "localStorage",
    "sessionStorage",
    `const window = {
       location: { reload: () => undefined },
       ExpBuilderRuntime: {
         emit: () => undefined,
         reportError: () => undefined
       }
     };
     ${resumeCode()};
     return _resolveResumeBranch;`,
  );
  return factory(createMemoryStorage(), createMemoryStorage()) as (
    resumeRaw: string | null,
  ) => ResumeBranchDecision | null;
}

type ResumeBranchDecision = {
  kind: "branch" | "sequential";
  sourceId: string | number | null;
  targetId: string;
  conditionId: string | number | null;
  customParameters: Record<string, unknown> | null;
  usedDefault: boolean;
};

function getResumeCheckpointFactory() {
  const factory = new Function(
    "localStorage",
    "sessionStorage",
    `const window = {
       location: { reload: () => undefined },
       ExpBuilderRuntime: {
         emit: () => undefined,
         reportError: () => undefined
       }
     };
     ${resumeCode()};
     return _createResumeCheckpoint;`,
  );
  return factory(createMemoryStorage(), createMemoryStorage()) as (
    trialData: Record<string, unknown>,
  ) => Record<string, unknown>;
}

function getResumeCheckpointFactoryWithManifest(
  nextBySource: Record<string, string>,
) {
  const factory = new Function(
    "localStorage",
    "sessionStorage",
    "nextBySource",
    `const window = {
       location: { reload: () => undefined },
       ExpBuilderRuntime: {
         emit: () => undefined,
         reportError: () => undefined
       },
       ExpBuilderExecutionAddresses: {
         version: 2,
         revision: 'r1',
         nextBySource,
         addressesByTarget: Object.fromEntries(
           Object.values(nextBySource).map(targetId => [
             String(targetId),
             {
               targetId,
               targetKind: 'trial',
               targetOwnerId: null,
               enterLoopIds: []
             }
           ])
         )
       }
     };
     ${resumeCode()};
     return _createResumeCheckpoint;`,
  );
  return factory(
    createMemoryStorage(),
    createMemoryStorage(),
    nextBySource,
  ) as (trialData: Record<string, unknown>) => Record<string, unknown>;
}

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mocks = hoistedMocks;

function ExperimentBaseHarness(
  ...args: Parameters<typeof ExperimentBase>
): ReturnType<typeof ExperimentBase> {
  return ExperimentBase(...args);
}

function PublicConfigurationHarness(
  ...args: Parameters<typeof PublicConfiguration>
): ReturnType<typeof PublicConfiguration> {
  return PublicConfiguration(...args);
}

export {
  ExperimentBaseHarness,
  generateAllCodesMock,
  getResumeCheckpointFactory,
  getResumeCheckpointFactoryWithManifest,
  getResumeResolver,
  mocks,
  normalize,
  PublicConfigurationHarness,
};
