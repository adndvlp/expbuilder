import { workspaceModel } from "../../../../../../../shared/experiment-workspace/dist/modelServices.js";
import { layout } from "./layout.js";
import { insertionEndpoints } from "./insertion.js";
let model: ReturnType<typeof workspaceModel> | undefined;
export function getModel(): ReturnType<typeof workspaceModel> {
  return (model ??= workspaceModel({ layout, insertionEndpoints }));
}
