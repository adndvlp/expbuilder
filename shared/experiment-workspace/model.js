import { install as installBasics } from "./model/basics.js";
import { install as installTopology } from "./model/topology.js";
import { install as installNavigation } from "./model/navigation.js";
import { install as installMutations } from "./model/mutations.js";
import { install as installLoopPlacement } from "./model/loopPlacement.js";
import { install as installEntry } from "./model/entry.js";
import { install as installClipboard } from "./model/clipboard.js";
export function createWorkspaceModel(services = {}) {
  const api = {};
  installBasics(api, services);
  installTopology(api, services);
  installNavigation(api, services);
  installMutations(api, services);
  installLoopPlacement(api, services);
  installEntry(api, services);
  installClipboard(api, services);
  const commands = {
    setDefault: api.setDefault,
    setThen: api.setThen,
    connect: api.connect,
    connectAtLoopLevel: api.connectAtLoopLevel,
    removeThen: api.removeThen,
    removeConnection: api.removeConnection,
    reconnectTarget: api.reconnectTarget,
    reconnectSource: api.reconnectSource,
    insertStructure: api.insertStructure,
    deleteTrial: api.deleteTrial,
    deleteLoop: api.deleteLoop,
    deleteItems: api.deleteItems,
    addTrial: api.addTrial,
    addChild: api.addChild,
    addLoopBranch: api.addLoopBranch,
    groupLoop: api.groupLoop,
    pasteItems: api.pasteItems,
  };
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
    ...Object.fromEntries(
      Object.entries(commands).map(([name, command]) => [
        name,
        (s, ...args) => api.editGraph(s, command, ...args),
      ]),
    ),
  };
}
