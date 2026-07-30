import { afterEach, vi } from "vitest";
import ExperimentBase from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ExperimentBase";
import PublicConfiguration from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/PublicConfiguration";
import { resumeCode } from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ResumeCode";

const hoistedMocks = vi.hoisted(() => ({
  generateAllCodes: vi.fn(),
  firestoreDoc: vi.fn(),
  firestoreGetDoc: vi.fn(),
  currentUser: { uid: "user-1" } as { uid: string } | null,
  devMode: {
    isDevMode: false,
    code: "dev-code",
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
    `${resumeCode()}; return _resolveResumeBranch;`,
  );
  return factory(createMemoryStorage(), createMemoryStorage()) as (
    resumeRaw: string | null,
  ) => string | null;
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
  getResumeResolver,
  mocks,
  normalize,
  PublicConfigurationHarness,
};
