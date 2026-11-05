import type { JsonTransport } from "../experiment-authoring/http";
import type { WorkspaceResponse, Delta } from "./types";

type Session = {
  snapshot?: WorkspaceResponse;
  loading?: Promise<WorkspaceResponse>;
  queue: Promise<unknown>;
  history: Delta[][];
  future: Delta[][];
  pending: number;
};
export function createWorkspaceClient(transport: JsonTransport) {
  const sessions = new Map<string, Session>();
  const session = (id: string) => {
    if (!sessions.has(id))
      sessions.set(id, {
        queue: Promise.resolve(),
        history: [],
        future: [],
        pending: 0,
      });
    return sessions.get(id)!;
  };
  const route = (id: string) => "/api/workspace/" + encodeURIComponent(id);
  const adopt = (id: string, response: WorkspaceResponse) => {
    const previous = session(id).snapshot;
    const decimal = (value: string) =>
      /^\d+$/.test(value) ? BigInt(value) : null;
    if (previous?.document.workspaceSchemaVersion === 2) {
      const oldRevision = decimal(previous.revision),
        newRevision = decimal(response.revision);
      if (
        response.document.workspaceSchemaVersion !== 2 ||
        (oldRevision !== null &&
          newRevision !== null &&
          oldRevision > newRevision)
      )
        return {
          ...response,
          document: previous.document,
          graph: previous.graph,
          revision: previous.revision,
        };
    }

    response.graph = { ...response.graph, workspace: response.document };
    session(id).snapshot = response;
    return response;
  };
  const perform = async (
    id: string,
    kind: string,
    args: Record<string, unknown>,
    expectedRevision?: string,
  ) => {
    const state = session(id),
      key = crypto.randomUUID();
    const request: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "X-Workspace-Schema": "2",
      },
      body: JSON.stringify({
        kind,
        args,
        expectedRevision: expectedRevision ?? state.snapshot?.revision,
      }),
    };
    let result: WorkspaceResponse;
    try {
      result = await transport.request<WorkspaceResponse>(
        route(id) + "/commands",
        request,
      );
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      result = await transport.request<WorkspaceResponse>(
        route(id) + "/commands",
        request,
      );
    }
    return adopt(id, result);
  };
  const load = async (
    id: string,
    force = false,
  ): Promise<WorkspaceResponse> => {
    const state = session(id);
    if (state.loading) return state.loading;
    if (state.snapshot && !force) return state.snapshot;
    state.loading = (async () => {
      const result = adopt(
        id,
        await transport.request<WorkspaceResponse>(route(id), {
          headers: { "X-Workspace-Schema": "2" },
        }),
      );
      return result.document.workspaceSchemaVersion === 2
        ? result
        : perform(id, "convertWorkspace", {});
    })();
    try {
      return await state.loading;
    } finally {
      state.loading = undefined;
    }
  };
  const enqueue = <T>(id: string, operation: () => Promise<T>) => {
    const state = session(id);
    state.pending++;
    const result = state.queue.catch(() => undefined).then(operation);
    state.queue = result
      .finally(() => {
        state.pending--;
      })
      .catch(() => undefined);
    return result;
  };
  const command = (
    id: string,
    kind: string,
    args: Record<string, unknown> = {},
    expectedRevision?: string,
    options: { recordHistory?: boolean } = {},
  ) =>
    enqueue(id, async () => {
      await load(id);
      const state = session(id),
        response = await perform(id, kind, args, expectedRevision);
      if (options.recordHistory !== false && response.undoPatch?.length) {
        state.history.push(response.undoPatch);
        if (state.history.length > 60) state.history.shift();
        state.future = [];
      }
      return response;
    });
  const travel = (id: string, redo: boolean) =>
    enqueue(id, async () => {
      await load(id);
      const state = session(id),
        from = redo ? state.future : state.history,
        to = redo ? state.history : state.future,
        changes = from[from.length - 1];
      if (!changes) return null;
      const response = await perform(id, "applyHistory", {
        changes,
        direction: redo ? "redo" : "undo",
      });
      from.pop();
      to.push(changes);
      return response;
    });
  return {
    load,
    command,
    adopt,
    peek: (id: string) => session(id).snapshot,
    canUndo: (id: string) =>
      session(id).history.length > 0 && !session(id).pending,
    canRedo: (id: string) =>
      session(id).future.length > 0 && !session(id).pending,
    undo: (id: string) => travel(id, false),
    redo: (id: string) => travel(id, true),
  };
}
