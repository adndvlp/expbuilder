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
  return new Function(`${resumeCode()}; return _resolveResumeBranch;`)() as (
    resumeRaw: string | null,
  ) => string | null;
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
