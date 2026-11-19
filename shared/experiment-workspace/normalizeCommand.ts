import type { WorkspaceCommand, NormalizedCommand } from "./commandTypes.js";
import { idKey } from "./navigation.js";
import { own } from "./valueUtils.js";
export function normalizeCommand(command: WorkspaceCommand): NormalizedCommand {
  switch (command.kind) {
    case "convertWorkspace":
      return { kind: command.kind, args: command.args ?? {} };
    case "addTrial":
      return command;
    case "addChild":
      return {
        kind: command.kind,
        args: {
          ...command.args,
          sourceId: idKey(command.args.sourceId),
          ...(own(command.args, "scopeId")
            ? { scopeId: idKey(command.args.scopeId) }
            : {}),
        },
      };
    case "connect":
      return {
        kind: command.kind,
        args: {
          ...command.args,
          sourceId: idKey(command.args.sourceId),
          targetId: idKey(command.args.targetId),
          ...(own(command.args, "scopeId")
            ? { scopeId: idKey(command.args.scopeId) }
            : {}),
          endpoints: command.args.endpoints
            ? {
                ...command.args.endpoints,
                entryId: idKey(command.args.endpoints.entryId),
                exitId: idKey(command.args.endpoints.exitId),
                ids: command.args.endpoints.ids?.map((id) => idKey(id)),
              }
            : undefined,
          previous: command.args.previous
            ? {
                source: idKey(command.args.previous.source),
                target: idKey(command.args.previous.target),
              }
            : undefined,
        },
      };
    case "removeConnection":
      return {
        kind: command.kind,
        args: {
          ...command.args,
          sourceId: idKey(command.args.sourceId),
          targetId: idKey(command.args.targetId),
        },
      };
    case "reconnectTarget":
      return {
        kind: command.kind,
        args: {
          ...command.args,
          sourceId: idKey(command.args.sourceId),
          oldTargetId: idKey(command.args.oldTargetId),
          targetId: idKey(command.args.targetId),
          ...(own(command.args, "scopeId")
            ? { scopeId: idKey(command.args.scopeId) }
            : {}),
        },
      };
    case "reconnectSource":
      return {
        kind: command.kind,
        args: {
          ...command.args,
          sourceId: idKey(command.args.sourceId),
          newSourceId: idKey(command.args.newSourceId),
          targetId: idKey(command.args.targetId),
          ...(own(command.args, "scopeId")
            ? { scopeId: idKey(command.args.scopeId) }
            : {}),
        },
      };
    case "deleteItems":
    case "groupLoop":
    case "reorderRoot":
      return {
        kind: command.kind,
        args: { ...command.args, ids: command.args.ids.map((id) => idKey(id)) },
      };
    case "deleteLoop":
      return {
        kind: command.kind,
        args: { ...command.args, loopId: idKey(command.args.loopId) },
      };
    case "updateLoop":
      return {
        kind: command.kind,
        args: { ...command.args, loopId: idKey(command.args.loopId) },
      };
    case "insertStructure":
      return {
        kind: command.kind,
        args: {
          ...command.args,
          itemId: idKey(command.args.itemId),
          sourceId: idKey(command.args.sourceId),
          targetId: idKey(command.args.targetId),
          endpoints: command.args.endpoints
            ? {
                ...command.args.endpoints,
                entryId: idKey(command.args.endpoints.entryId),
                exitId: idKey(command.args.endpoints.exitId),
                ids: command.args.endpoints.ids?.map((id) => idKey(id)),
              }
            : undefined,
        },
      };
    case "moveGroup":
      return {
        kind: command.kind,
        args: { ...command.args, itemId: idKey(command.args.itemId) },
      };
    case "updateTrial":
      return {
        kind: command.kind,
        args: { ...command.args, trialId: idKey(command.args.trialId) },
      };
    case "pasteItems":
      return command;
    default:
      throw Object.assign(
        Error(
          `Unknown workspace command ${String(Reflect.get(command, "kind"))}`,
        ),
        { status: 400 },
      );
  }
}
