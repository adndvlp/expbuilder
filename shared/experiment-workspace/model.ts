import type { ModelInternals, ModelServices } from "./modelContracts.js";
import type { ModelState } from "./types.js";
import { create as createBasics } from "./model/basics.js";
import { create as createTopology } from "./model/topology.js";
import { create as createNavigation } from "./model/navigation.js";
import { create as createMutations } from "./model/mutations.js";
import { create as createLoopPlacement } from "./model/loopPlacement.js";
import { create as createEntry } from "./model/entry.js";
import { create as createClipboard } from "./model/clipboard.js";
export function createWorkspaceModel(services: ModelServices) {
  const api: ModelInternals = {
    ...createBasics(() => api),
    ...createTopology(() => api),
    ...createNavigation(() => api, services),
    ...createMutations(() => api),
    ...createLoopPlacement(() => api, services),
    ...createEntry(() => api),
    ...createClipboard(() => api, services),
  };
  const wrap =
    <A extends unknown[], R>(command: (state: ModelState, ...args: A) => R) =>
    (state: ModelState, ...args: A) =>
      api.editGraph(state, command, ...args);
  return {
    FINISH: api.FINISH,
    copy: api.copy,
    copyItems: api.copyItems,
    trial: api.trial,
    makeState: api.makeState,
    item: api.item,
    realTrial: api.realTrial,
    members: api.members,
    ancestors: api.ancestors,
    resolve: api.resolve,
    connections: api.connections,
    reachable: api.reachable,
    components: api.components,
    componentFor: api.componentFor,
    leafTrials: api.leafTrials,
    normalizeConnection: api.normalizeConnection,
    loopBranchLevels: api.loopBranchLevels,
    loopConnectionContext: api.loopConnectionContext,
    loopBranchSelection: api.loopBranchSelection,
    reconcileGraph: api.reconcileGraph,
    layout: api.layout,
    moveComponent: api.moveComponent,
    compile: api.compile,
    serialize: api.serialize,
    restore: api.restore,
    setDefault: wrap(api.setDefault),
    setThen: wrap(api.setThen),
    connect: wrap(api.connect),
    connectAtLoopLevel: wrap(api.connectAtLoopLevel),
    removeThen: wrap(api.removeThen),
    removeConnection: wrap(api.removeConnection),
    reconnectTarget: wrap(api.reconnectTarget),
    reconnectSource: wrap(api.reconnectSource),
    insertStructure: wrap(api.insertStructure),
    deleteTrial: wrap(api.deleteTrial),
    deleteLoop: wrap(api.deleteLoop),
    deleteItems: wrap(api.deleteItems),
    addTrial: wrap(api.addTrial),
    addChild: wrap(api.addChild),
    addLoopBranch: wrap(api.addLoopBranch),
    groupLoop: wrap(api.groupLoop),
    pasteItems: wrap(api.pasteItems),
  };
}
