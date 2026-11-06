import type {
  ModelState,
  ModelItem,
  ItemId,
} from "../../../../../../../shared/experiment-workspace/dist/types.js";
import { isModelLoop } from "../../../../../../../shared/experiment-workspace/dist/types.js";
import {
  hasId,
  last,
  required,
} from "../../../../../../../shared/experiment-workspace/dist/valueUtils.js";
import type { TimelineItem } from "../../../contexts/TrialsContext";
type LayoutInput = Parameters<typeof buildUnifiedFlowLayout>[0] &
  Required<
    Pick<
      Parameters<typeof buildUnifiedFlowLayout>[0],
      "branchEdges" | "entryItemIds" | "scopeParents"
    >
  >;
// Project each disconnected structure through the app's canonical canvas layout.
import {
  buildUnifiedFlowLayout,
  getLoopLayoutScopeId,
} from "../services/buildUnifiedFlowLayout";
import { getModel as M } from "./model.js";
const owner = (i: ModelItem) => i.parentLoopId ?? null;
const order = (ids: string[], declared: ItemId[] = []) => {
  const rank = new Map(declared.map((id, index) => [String(id), index]));
  return [...ids].sort(
    (a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity),
  );
};
export function inputFor(
  s: ModelState,
  ids = new Set([...s.trials, ...s.loops].map((i) => i.id)),
): LayoutInput {
  const model = M();
  const all = [...s.trials, ...s.loops].filter((i) => ids.has(i.id));
  const scopedOwner = (i: ModelItem) =>
    hasId(ids, owner(i)) ? owner(i) : null;
  const active = model
    .connections(s)
    .filter((e) => ids.has(e.source) && ids.has(e.target));
  const timelineFor = (parent: string | null): TimelineItem[] => {
    const own = all.filter((i) => scopedOwner(i) === parent);
    return order(
      own.map((i) => i.id),
      s.scopeOrder?.[parent ?? "root"],
    ).map((id) => {
      const i = required(own.find((i) => i.id === id));
      if (isModelLoop(i))
        return {
          id,
          name: i.name,
          type: "loop",
          parentLoopId: parent,
          trials: all.filter((i) => scopedOwner(i) === id).map((i) => i.id),
          nextItemId: i.nextId ?? null,
        };
      return {
        id,
        name: i.name,
        type: "trial",
        parentLoopId: parent,
        branches: order(
          active.filter((e) => e.source === id).map((e) => e.target),
          i.destinationOrder,
        ),
        defaultNextTrialId: i.defaultNextTrialId,
      };
    });
  };
  const branchEdges = active.map((e) => {
    const source = required(model.item(s, e.source)),
      target = required(model.item(s, e.target));
    const targetOwners = new Set(model.ancestors(s, target).map((l) => l.id));
    return {
      sourceId: e.source,
      targetId: e.target,
      sourceOwnerId: scopedOwner(source),
      targetOwnerId: scopedOwner(target),
      exitedLoopIds: model
        .ancestors(s, source)
        .map((l) => l.id)
        .filter((id) => ids.has(id) && !targetOwners.has(id)),
    };
  });
  const loops = s.loops.filter((l) => ids.has(l.id));
  const entry = model.item(s, s.entryId);
  let rootEntry: ItemId | null =
    (entry &&
      last(model.ancestors(s, entry).filter((l) => ids.has(l.id)))?.id) ||
    s.entryId;
  if (!hasId(ids, rootEntry == null ? null : String(rootEntry))) {
    const roots = timelineFor(null);
    const rootOf = (id: string) => {
      const i = model.item(s, id);
      return last(model.ancestors(s, i).filter((l) => ids.has(l.id)))?.id ?? id;
    };
    const incoming = new Set(
      active
        .filter((e) => rootOf(e.source) !== rootOf(e.target))
        .map((e) => rootOf(e.target)),
    );
    rootEntry =
      (roots.find((i) => !incoming.has(String(i.id))) ?? roots[0])?.id ?? null;
  }
  return {
    timeline: timelineFor(null),
    expandedPath: loops
      .filter(
        (l) =>
          l.expanded &&
          model
            .ancestors(s, l)
            .filter((p) => ids.has(p.id))
            .every((p) => p.expanded),
      )
      .map((l) => ({
        loop: { id: l.id, name: l.name, parentLoopId: scopedOwner(l) },
        items: timelineFor(l.id),
      })),
    selectedItemId: null,
    selectedScopeId: null,
    branchEdges,
    scopeParents: Object.fromEntries(loops.map((l) => [l.id, scopedOwner(l)])),
    entryItemIds: Object.fromEntries([
      ["root", rootEntry],
      ...loops.map((l) => [getLoopLayoutScopeId(l.id), l.entryId]),
    ]),
    onSelectTrial: () => {},
    onSelectLoop: () => {},
    onToggleLoop: () => {},
    onAddBranch: () => {},
  };
}
export function productionLayout(s: ModelState, ids: Set<string>) {
  return buildUnifiedFlowLayout(inputFor(s, ids));
}
