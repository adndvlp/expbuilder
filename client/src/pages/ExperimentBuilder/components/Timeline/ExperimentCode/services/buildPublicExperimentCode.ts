import { publicDatabaseCode } from "./publicDatabaseCode";
import { publicFirebaseCode } from "./publicFirebaseCode";
import { publicSessionCode } from "./publicSessionCode";
import { publicBootstrapCode } from "./publicBootstrapCode";
import { publicBatchCode } from "./publicBatchCode";
import { publicInitCode } from "./publicInitCode";
import { publicFinishCode } from "./publicFinishCode";
import { PublicExperimentCodeOptions } from "./publicCodeTypes";
import { composeRuntimeCode } from "../../../../modules/experiment-runtime/runtimeStateContract";

export function buildPublicExperimentCode(
  options: PublicExperimentCodeOptions,
): string {
  const database = publicDatabaseCode(options);
  const firebase = publicFirebaseCode(options);
  const session = publicSessionCode(options);
  const bootstrap = publicBootstrapCode(options);
  const batch = publicBatchCode(options);
  const init = publicInitCode(options);
  const finish = publicFinishCode(options);
  return composeRuntimeCode([
    { owner: "public-database", code: database, accesses: [] },
    { owner: "public-firebase", code: firebase, accesses: [] },
    {
      owner: "public-session",
      code: session,
      accesses: [
        {
          state: "jump",
          mode: "writer",
          evidence: "localStorage.setItem(JUMP_REQUEST_KEY, JSON.stringify(request))",
        },
        {
          state: "cleanup",
          mode: "writer",
          evidence: "clearTransientState() {",
        },
      ],
    },
    {
      owner: "public-bootstrap",
      code: bootstrap,
      accesses: [
        {
          state: "route",
          mode: "consumer",
          evidence: "resumeRouteDecision = _resolveResumeBranch(resumeRaw)",
        },
        {
          state: "jump",
          mode: "consumer",
          evidence: "window.ExpBuilderNavigation.consumeReloadMarker()",
        },
        {
          state: "custom-parameters",
          mode: "writer",
          evidence: "window.branchCustomParameters =",
        },
      ],
    },
    { owner: "public-batch", code: batch, accesses: [] },
    {
      owner: "public-init",
      code: init,
      accesses: [
        {
          state: "route",
          mode: "writer",
          evidence: "JSON.stringify(_createResumeCheckpoint(data))",
        },
      ],
    },
    {
      owner: "public-finish",
      code: finish,
      accesses: [
        {
          state: "custom-parameters",
          mode: "consumer",
          evidence: /Object\.entries\([^)]*[Bb]ranchCustomParameters\)/,
        },
        {
          state: "cleanup",
          mode: "consumer",
          evidence: "window.ExpBuilderNavigation.clearTransientState()",
        },
      ],
    },
  ]);
}
