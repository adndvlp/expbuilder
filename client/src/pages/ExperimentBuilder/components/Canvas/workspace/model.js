import { workspaceModel } from "../../../../../../../shared/experiment-workspace/modelServices.js";
import { layout } from "./layout.js";
import { insertionEndpoints } from "./insertion.js";
let model;
export function getModel() {
  return (model ??= workspaceModel({ layout, insertionEndpoints }));
}
