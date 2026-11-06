import type {
  ModelState,
  Point,
  StructureEndpoints,
  ModelConnection,
} from "../../../../../../../shared/experiment-workspace/dist/types.js";
import {
  last as lastValue,
  required,
} from "../../../../../../../shared/experiment-workspace/dist/valueUtils.js";
import type {
  WorkspaceLayout,
  WorkspaceNode,
  WorkspaceEdge,
  Candidate,
} from "./types";
type Eligible = { edge: WorkspaceEdge; connection: ModelConnection };
type Hit = Pick<Candidate, "sourceId" | "targetId" | "distance" | "side">;
type FamilyHit = Eligible & { source: WorkspaceNode; target: WorkspaceNode };
import { getModel as M } from "./model.js";
import { productionLayout } from "./input.js";
export function insertionEndpoints(
  s: ModelState,
  itemId: string,
  fromTrialId?: string,
): StructureEndpoints | null {
  const model = M(),
    component = model.componentFor(s, itemId);
  if (!component || component.locked) return null;
  const expanded = model.copy(s);
  expanded.loops.forEach((l) => {
    if (component.ids.has(l.id)) l.expanded = true;
  });
  const flow = productionLayout(expanded, component.ids);
  const reachable = fromTrialId
    ? model.reachable({ ...s, entryId: fromTrialId }).trials
    : null;
  const trials = flow.nodes
    .filter(
      (n) =>
        n.type === "trial" &&
        (!reachable || reachable.has(String(n.data.itemId))),
    )
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  if (!trials.length) return null;
  return {
    entryId: fromTrialId ?? String(trials[0].data.itemId),
    exitId: String(required(lastValue(trials)).data.itemId),
    ids: [...component.ids],
  };
}
export { previewInsertion } from "./preview.js";
export function findInsertion(
  s: ModelState,
  flow: WorkspaceLayout,
  itemId: string,
  point: Point,
  zoom = 1,
): Candidate | null {
  const model = M(),
    component = model.componentFor(s, itemId);
  if (!component || component.locked) return null;
  const semantic = new Map(model.connections(s).map((e) => [e.id, e]));
  const byId = new Map(flow.flowNodes.map((n) => [n.id, n])),
    eligible: Eligible[] = [],
    hits: Hit[] = [];
  let best: Candidate | null = null;
  for (const edge of flow.flowEdges) {
    if (edge.data.control || (edge.data.semanticEdgeIds?.length ?? 0) > 1)
      continue;
    const connection = edge.data.semantic
      ? semantic.get(edge.data.semantic)
      : undefined;
    if (
      !connection ||
      component.ids.has(connection.source) ||
      component.ids.has(connection.target)
    )
      continue;
    eligible.push({ edge, connection });
    const curve = edge.data.curve ?? [];
    let nearest: { point: Point; distance: number } | null = null;
    for (const segment of curve) {
      for (let i = 1; i < 48; i++) {
        const t = i / 48,
          u = 1 - t;
        const p = { x: 0, y: 0 };
        for (const axis of ["x", "y"] as const)
          p[axis] =
            u * u * u * segment.start[axis] +
            3 * u * u * t * segment.control1[axis] +
            3 * u * t * t * segment.control2[axis] +
            t * t * t * segment.end[axis];
        const distance = Math.hypot(point.x - p.x, point.y - p.y) * zoom;
        if (!nearest || distance < nearest.distance)
          nearest = { point: p, distance };
      }
    }
    if (!nearest || nearest.distance > 100) continue;
    const start = curve[0].start,
      end = required(lastValue(curve)).end;
    if (
      Math.min(
        Math.hypot(nearest.point.x - start.x, nearest.point.y - start.y),
        Math.hypot(nearest.point.x - end.x, nearest.point.y - end.y),
      ) *
        zoom <
      16
    )
      continue;
    const dx = (point.x - nearest.point.x) * zoom,
      dy = (point.y - nearest.point.y) * zoom;
    hits.push({
      sourceId: connection.source,
      targetId: connection.target,
      distance: nearest.distance,
      side: dx < 0 ? "left" : "right",
    });
    const mode =
      nearest.distance <= 24
        ? "sequential"
        : Math.abs(dx) >= 28 && Math.abs(dy) <= 55
          ? "parallel"
          : null;
    if (!mode || (best && best.distance <= nearest.distance)) continue;
    best = {
      sourceId: connection.source,
      targetId: connection.target,
      mode,
      side: dx < 0 ? "left" : "right",
      distance: nearest.distance,
    };
  }
  // An individual arm remains a sequential insertion target. Shared fork areas
  // and gaps between siblings represent an additional branch of their parent.
  const precise = [
    ...new Map(
      hits
        .filter((h) => h.distance <= 10)
        .map((h) => [JSON.stringify([h.sourceId, h.targetId]), h]),
    ).values(),
  ];
  const isolatedArm =
    precise.length === 1 &&
    !hits.some(
      (h) =>
        h.sourceId === precise[0].sourceId &&
        h.targetId !== precise[0].targetId &&
        h.distance <= 24,
    );
  const families = new Map<string, FamilyHit[]>();
  for (const hit of eligible) {
    const source = byId.get(hit.edge.source),
      target = byId.get(hit.edge.target);
    if (
      !source ||
      !target ||
      target.position.y < source.position.y + source.measured.height
    )
      continue;
    const key = JSON.stringify([
      hit.connection.source,
      source.id,
      Math.round(target.position.y * 1000),
    ]);
    if (!families.has(key)) families.set(key, []);
    required(families.get(key)).push({ ...hit, source, target });
  }
  let fork: Candidate | null = null;
  for (const family of families.values()) {
    const peers = [
      ...new Map(family.map((h) => [h.target.id, h])).values(),
    ].sort((a, b) => a.target.position.x - b.target.position.x);
    if (peers.length < 2) continue;
    const first = peers[0],
      last = required(lastValue(peers)),
      top = first.target.position.y,
      bottom = Math.max(
        ...peers.map((h) => h.target.position.y + h.target.measured.height),
      );
    const parentBottom = first.source.position.y + first.source.measured.height;
    if (
      point.y < parentBottom + 16 / zoom ||
      point.y > bottom + 24 / zoom ||
      point.x < first.target.position.x - 100 / zoom ||
      point.x > last.target.position.x + last.target.measured.width + 100 / zoom
    )
      continue;
    if (
      point.y >= top - 12 / zoom &&
      peers.some(
        (h) =>
          point.x >= h.target.position.x &&
          point.x <= h.target.position.x + h.target.measured.width,
      )
    )
      continue;
    const next = peers.find(
        (h) => point.x < h.target.position.x + h.target.measured.width / 2,
      ),
      anchor = next ?? last;
    const junction =
      Math.abs(
        point.x - first.source.position.x - first.source.measured.width / 2,
      ) *
        zoom <=
        24 && (point.y - parentBottom) * zoom <= 48;
    const distance =
      Math.abs(point.y - (top + bottom) / 2) * zoom +
      Math.abs(
        point.x - first.source.position.x - first.source.measured.width / 2,
      ) *
        zoom *
        0.001;
    if (
      !fork ||
      Number(junction) > Number(fork.junction) ||
      (junction === fork.junction && distance < fork.distance)
    )
      fork = {
        sourceId: anchor.connection.source,
        targetId: anchor.connection.target,
        mode: "parallel",
        side: next ? "left" : "right",
        distance,
        junction,
      };
  }
  if (fork?.junction) return fork;
  if (isolatedArm) return { ...precise[0], mode: "sequential" };
  if (fork) return fork;
  return best;
}
