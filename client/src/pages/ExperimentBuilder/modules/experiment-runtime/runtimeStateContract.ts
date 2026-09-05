export const REQUIRED_RUNTIME_STATES = [
  "route",
  "jump",
  "custom-parameters",
  "cleanup",
] as const;

export type RuntimeStateName = (typeof REQUIRED_RUNTIME_STATES)[number];
export type RuntimeStateAccessMode = "writer" | "consumer";

export type RuntimeStateAccess = {
  state: RuntimeStateName;
  mode: RuntimeStateAccessMode;
  evidence: string | RegExp;
};

export type RuntimeCodeFragment = {
  owner: string;
  code: string;
  accesses: readonly RuntimeStateAccess[];
};

export class RuntimeStateContractError extends Error {
  constructor(message: string) {
    super(`Runtime state contract failed: ${message}`);
    this.name = "RuntimeStateContractError";
  }
}

const containsEvidence = (code: string, evidence: string | RegExp) => {
  if (typeof evidence === "string") return code.includes(evidence);
  return new RegExp(
    evidence.source,
    evidence.flags.replace(/g/g, "").replace(/y/g, ""),
  ).test(code);
};

const describeEvidence = (evidence: string | RegExp) =>
  typeof evidence === "string" ? JSON.stringify(evidence) : String(evidence);

export function composeRuntimeCode(
  fragments: readonly RuntimeCodeFragment[],
  separator = "",
) {
  const accesses = new Map<
    RuntimeStateName,
    Set<RuntimeStateAccessMode>
  >();
  fragments.forEach((fragment) => {
    fragment.accesses.forEach((access) => {
      if (!containsEvidence(fragment.code, access.evidence)) {
        throw new RuntimeStateContractError(
          `${fragment.owner} declares ${access.state} ${access.mode} ` +
            `but does not emit ${describeEvidence(access.evidence)}`,
        );
      }
      const modes = accesses.get(access.state) ?? new Set();
      modes.add(access.mode);
      accesses.set(access.state, modes);
    });
  });
  REQUIRED_RUNTIME_STATES.forEach((state) => {
    const modes = accesses.get(state);
    if (!modes?.has("writer")) {
      throw new RuntimeStateContractError(`${state} has no reachable writer`);
    }
    if (!modes.has("consumer")) {
      throw new RuntimeStateContractError(
        `${state} has no reachable consumer`,
      );
    }
  });
  return fragments.map((fragment) => fragment.code).join(separator);
}
