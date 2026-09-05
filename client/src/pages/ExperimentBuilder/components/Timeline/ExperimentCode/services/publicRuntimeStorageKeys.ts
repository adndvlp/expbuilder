import type { NavigationStorageKeys } from "../../../../modules/experiment-runtime/navigationCoordinator";

export type PublicRuntimeStorageKeys = NavigationStorageKeys & {
  sessionId: string;
  participant: string;
  captchaPassed: string;
  trialDatabase: string;
};

export function getPublicRuntimeStorageKeys(
  experimentID: string | undefined,
): PublicRuntimeStorageKeys {
  const namespace = `expbuilder:public:${experimentID ?? ""}:`;

  return {
    sessionId: `${namespace}session-id`,
    participant: `${namespace}participant-number`,
    captchaPassed: `${namespace}captcha-passed`,
    jumpRequest: `${namespace}jump-request`,
    jumpReload: `${namespace}jump-reload`,
    resumeTrial: `${namespace}resume-trial`,
    jumpTarget: `${namespace}jump-to-trial`,
    jumpContext: `${namespace}jump-context`,
    trialDatabase: `${namespace}trials-v1`,
  };
}
