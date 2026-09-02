export type ExecutionAddress = {
  targetId: string | number;
  targetKind: "trial" | "loop";
  targetOwnerId: string | null;
  enterLoopIds: string[];
};

export type JumpRequestV2 = {
  version: 2;
  experimentRevision: string;
  address: ExecutionAddress;
  sourceId: string | null;
  sourceTrialIndex: string | null;
  cursor: {
    nextEnterIndex: number;
    progress: number;
  };
  reloadGuard: {
    observedProgress: number | null;
  };
  context: Record<string, unknown>;
};

export type JumpEntryResult = {
  allowed: boolean;
  consumed: "none" | "segment" | "target";
  segmentId: string | null;
  request: JumpRequestV2 | null;
};

export type JumpReloadResult = {
  status: "ready" | "stalled";
  request: JumpRequestV2;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeNavigationId(value: unknown): string | null {
  return value === undefined || value === null ? null : String(value);
}

export function isJumpRequest(value: unknown): value is JumpRequestV2 {
  if (!isRecord(value) || value.version !== 2) return false;
  const address = value.address;
  const cursor = value.cursor;
  const guard = value.reloadGuard;
  if (!isRecord(address) || !isRecord(cursor) || !isRecord(guard)) {
    return false;
  }
  if (typeof value.experimentRevision !== "string") return false;
  if (
    typeof address.targetId !== "string" &&
    typeof address.targetId !== "number"
  ) {
    return false;
  }
  if (address.targetKind !== "trial" && address.targetKind !== "loop") {
    return false;
  }
  if (address.targetOwnerId !== null && typeof address.targetOwnerId !== "string") {
    return false;
  }
  if (!Array.isArray(address.enterLoopIds)) return false;
  if (!address.enterLoopIds.every((id) => typeof id === "string")) {
    return false;
  }
  if (
    typeof cursor.nextEnterIndex !== "number" ||
    !Number.isInteger(cursor.nextEnterIndex) ||
    cursor.nextEnterIndex < 0
  ) {
    return false;
  }
  if (cursor.nextEnterIndex > address.enterLoopIds.length) return false;
  if (
    typeof cursor.progress !== "number" ||
    !Number.isInteger(cursor.progress) ||
    cursor.progress < 0
  ) {
    return false;
  }
  if (
    guard.observedProgress !== null &&
    (typeof guard.observedProgress !== "number" ||
      !Number.isInteger(guard.observedProgress) ||
      guard.observedProgress < 0)
  ) {
    return false;
  }
  return (
    (value.sourceId === null || typeof value.sourceId === "string") &&
    (value.sourceTrialIndex === null ||
      typeof value.sourceTrialIndex === "string") &&
    isRecord(value.context)
  );
}

export function parseJumpRequest(raw: string | null): JumpRequestV2 | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isJumpRequest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createJumpRequest(
  address: ExecutionAddress,
  experimentRevision: string,
  sourceId: unknown,
  sourceTrialIndex: unknown,
  context: Record<string, unknown> = {},
): JumpRequestV2 {
  return {
    version: 2,
    experimentRevision,
    address: {
      targetId: address.targetId,
      targetKind: address.targetKind,
      targetOwnerId:
        address.targetOwnerId === null ? null : String(address.targetOwnerId),
      enterLoopIds: address.enterLoopIds.map(String),
    },
    sourceId: normalizeNavigationId(sourceId),
    sourceTrialIndex: normalizeNavigationId(sourceTrialIndex),
    cursor: { nextEnterIndex: 0, progress: 0 },
    reloadGuard: { observedProgress: null },
    context: { ...context },
  };
}

export function allowsJumpItem(
  request: JumpRequestV2,
  itemId: unknown,
  itemKind: "trial" | "loop",
): boolean {
  const normalizedId = normalizeNavigationId(itemId);
  const nextLoopId =
    request.address.enterLoopIds[request.cursor.nextEnterIndex] ?? null;
  if (nextLoopId !== null) {
    return itemKind === "loop" && normalizedId === nextLoopId;
  }
  return (
    normalizedId === normalizeNavigationId(request.address.targetId) &&
    itemKind === request.address.targetKind
  );
}

export function enterJumpItem(
  request: JumpRequestV2,
  itemId: unknown,
  itemKind: "trial" | "loop",
): JumpEntryResult {
  if (!allowsJumpItem(request, itemId, itemKind)) {
    return {
      allowed: false,
      consumed: "none",
      segmentId: null,
      request,
    };
  }
  const nextLoopId =
    request.address.enterLoopIds[request.cursor.nextEnterIndex] ?? null;
  if (nextLoopId !== null) {
    return {
      allowed: true,
      consumed: "segment",
      segmentId: nextLoopId,
      request: {
        ...request,
        cursor: {
          nextEnterIndex: request.cursor.nextEnterIndex + 1,
          progress: request.cursor.progress + 1,
        },
      },
    };
  }
  return {
    allowed: true,
    consumed: "target",
    segmentId: null,
    request: null,
  };
}

export function observeJumpReload(request: JumpRequestV2): JumpReloadResult {
  const observed = request.reloadGuard.observedProgress;
  if (observed !== null && observed === request.cursor.progress) {
    return { status: "stalled", request };
  }
  return {
    status: "ready",
    request: {
      ...request,
      cursor: {
        ...request.cursor,
        nextEnterIndex: observed === null ? request.cursor.nextEnterIndex : 0,
      },
      reloadGuard: { observedProgress: request.cursor.progress },
    },
  };
}

export function getJumpRequestRuntimeCode(): string {
  return `
    const isRecord = ${isRecord.toString()};
    const normalizeNavigationId = ${normalizeNavigationId.toString()};
    const isJumpRequest = ${isJumpRequest.toString()};
    const parseJumpRequest = ${parseJumpRequest.toString()};
    const createJumpRequest = ${createJumpRequest.toString()};
    const allowsJumpItem = ${allowsJumpItem.toString()};
    const enterJumpItem = ${enterJumpItem.toString()};
    const observeJumpReload = ${observeJumpReload.toString()};
    window.ExpBuilderJumpProtocol = Object.freeze({
      parse: parseJumpRequest,
      create: createJumpRequest,
      allows: allowsJumpItem,
      enter: enterJumpItem,
      observeReload: observeJumpReload
    });
  `;
}
