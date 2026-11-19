import type {
  Fragment,
  ModelTrial,
  ModelLoop,
  ModelState,
  Point,
} from "./types.js";
import { isRecord } from "./valueUtils.js";
const id = (value: unknown): value is string | null =>
  value === null || typeof value === "string";
const point = (value: unknown): value is Point =>
  isRecord(value) &&
  typeof value.x === "number" &&
  Number.isFinite(value.x) &&
  typeof value.y === "number" &&
  Number.isFinite(value.y);
const trial = (value: unknown): value is ModelTrial =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  id(value.parentLoopId) &&
  id(value.defaultNextTrialId) &&
  Array.isArray(value.thenGoTo) &&
  value.thenGoTo.every(
    (rule: unknown) =>
      isRecord(rule) &&
      (typeof rule.id === "string" || typeof rule.id === "number") &&
      id(rule.targetId),
  );
const loop = (value: unknown): value is ModelLoop =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  id(value.parentLoopId) &&
  id(value.entryId) &&
  id(value.nextId) &&
  typeof value.repetitions === "number" &&
  typeof value.expanded === "boolean";
export function isWorkspaceFragment(value: unknown): value is Fragment {
  return (
    isRecord(value) &&
    value.schema === "branching-workspace-fragment/1" &&
    Array.isArray(value.trials) &&
    value.trials.every(trial) &&
    Array.isArray(value.loops) &&
    value.loops.every(loop) &&
    isRecord(value.scopeOrder) &&
    Object.values(value.scopeOrder).every(
      (order) =>
        Array.isArray(order) &&
        order.every((id: unknown) => typeof id === "string"),
    ) &&
    isRecord(value.positions) &&
    Object.values(value.positions).every(point)
  );
}

export function isWorkspaceState(value: unknown): value is ModelState {
  return (
    isRecord(value) &&
    value.schema === "branching-workspace-model/2" &&
    typeof value.name === "string" &&
    id(value.entryId) &&
    typeof value.sequence === "number" &&
    Number.isFinite(value.sequence) &&
    Array.isArray(value.notes) &&
    value.notes.every((note: unknown) => typeof note === "string") &&
    Array.isArray(value.trials) &&
    value.trials.every(trial) &&
    Array.isArray(value.loops) &&
    value.loops.every(loop) &&
    isRecord(value.anchors) &&
    Object.values(value.anchors).every(point) &&
    isRecord(value.scopeOrder) &&
    Object.values(value.scopeOrder).every(
      (order) =>
        Array.isArray(order) &&
        order.every((id: unknown) => typeof id === "string"),
    )
  );
}
