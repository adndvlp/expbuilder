import { describe, expect, it, vi } from "vitest";
import { createWorkspaceClient } from "../../pages/ExperimentBuilder/modules/experiment-workspace/client";

describe("workspace client command queue", () => {
  it("converts once and serializes mutations using the latest acknowledged revision", async () => {
    let revision = "seed",
      version = 1;
    const received: Record<string, unknown>[] = [];
    const transport = {
      async request<T>(path: string, init?: RequestInit): Promise<T> {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          received.push(body);
          expect(body.expectedRevision).toBe(revision);
          revision = String(received.length);
          if (body.kind === "convertWorkspace") version = 2;
        }
        return {
          revision,
          document: {
            workspaceSchemaVersion: version,
            trials: [],
            loops: [],
            timeline: [],
            entryItemId: null,
          },
          graph: { revision, root: { items: [] }, scopes: {}, edges: [] },
          undoPatch: [],
        } as T;
      },
    };
    const client = createWorkspaceClient(transport);
    await client.load("exp");
    await Promise.all([
      client.command("exp", "addTrial", {}),
      client.command("exp", "addTrial", {}),
    ]);
    expect(received.map((x) => x.kind)).toEqual([
      "convertWorkspace",
      "addTrial",
      "addTrial",
    ]);
    expect(client.peek("exp")?.revision).toBe("3");
  });
  it("does not put conversion in the user undo history", async () => {
    let version = 1;
    const transport = {
      async request<T>(_path: string, init?: RequestInit): Promise<T> {
        if (init?.method === "POST") version = 2;
        return {
          revision: String(version),
          document: {
            workspaceSchemaVersion: version,
            trials: [],
            loops: [],
            timeline: [],
          },
          graph: { root: { items: [] }, scopes: {}, edges: [] },
          undoPatch: [
            {
              path: ["entryItemId"],
              hasBefore: true,
              before: null,
              hasAfter: true,
              after: 1,
            },
          ],
        } as T;
      },
    };
    const client = createWorkspaceClient(transport);
    await client.load("exp");
    expect(client.canUndo("exp")).toBe(false);
  });
});

it("retries a lost response with the same idempotency key and payload", async () => {
  const payloads: RequestInit[] = [];
  let sent = false;
  const response = (version: number, revision: string) => ({
    revision,
    document: {
      workspaceSchemaVersion: version,
      trials: [],
      loops: [],
      timeline: [],
    },
    graph: { revision, root: { items: [] }, scopes: {}, edges: [] },
    undoPatch: [],
  });
  const transport = {
    async request<T>(_path: string, init?: RequestInit): Promise<T> {
      if (!init?.body) return response(2, "1") as T;
      payloads.push(init);
      if (!sent) {
        sent = true;
        throw new TypeError("Failed to fetch");
      }
      return response(2, "2") as T;
    },
  };
  const client = createWorkspaceClient(transport);
  await client.command("test", "addTrial", {});
  expect(payloads).toHaveLength(2);
  expect(payloads[0].body).toBe(payloads[1].body);
  expect(payloads[0].headers).toEqual(payloads[1].headers);
});

it("a late graph read cannot replace a more recent acknowledged command", async () => {
  type ResponseValue = {
    revision: string;
    document: {
      workspaceSchemaVersion: number;
      trials: unknown[];
      loops: unknown[];
      timeline: unknown[];
    };
    graph: object;
    undoPatch: unknown[];
  };
  const response = (revision: string): ResponseValue => ({
    revision,
    document: {
      workspaceSchemaVersion: 2,
      trials: [],
      loops: [],
      timeline: [],
    },
    graph: { root: { items: [] }, scopes: {}, edges: [] },
    undoPatch: [],
  });
  let gets = 0,
    completeRead: (value: ResponseValue) => void = () => {},
    completeWrite: (value: ResponseValue) => void = () => {},
    writeStarted = false;
  const transport = {
    async request<T>(_path: string, init?: RequestInit): Promise<T> {
      if (init?.method === "POST") {
        writeStarted = true;
        return new Promise((resolve) => {
          completeWrite = (value) => resolve(value as T);
        });
      }
      if (gets++ === 0) return response("1") as T;
      return new Promise((resolve) => {
        completeRead = (value) => resolve(value as T);
      });
    },
  };
  const client = createWorkspaceClient(transport);
  await client.load("exp");
  const writing = client.command("exp", "addTrial");
  await vi.waitFor(() => expect(writeStarted).toBe(true));
  const reading = client.load("exp", true);
  completeWrite(response("2"));
  await writing;
  completeRead(response("1"));
  await reading;
  expect(client.peek("exp")!.revision).toBe("2");
});

it("retains 60 user operations and excludes regenerable cache writes from history", async () => {
  let revision = 1;
  const histories: unknown[] = [];
  const transport = {
    async request<T>(_path: string, init?: RequestInit): Promise<T> {
      let patch: unknown[] = [];
      if (init?.body) {
        const body = JSON.parse(String(init.body));
        revision++;
        if (body.kind === "applyHistory") histories.push(body.args);
        else
          patch = [
            {
              path: ["trials", 1, "name"],
              hasBefore: true,
              before: String(revision - 1),
              hasAfter: true,
              after: String(revision),
            },
          ];
      }
      return {
        revision: String(revision),
        document: {
          workspaceSchemaVersion: 2,
          trials: [],
          loops: [],
          timeline: [],
        },
        graph: { root: { items: [] }, scopes: {}, edges: [] },
        undoPatch: patch,
      } as T;
    },
  };
  const client = createWorkspaceClient(transport);
  for (let i = 0; i < 61; i++) await client.command("exp", "updateTrial", {});
  await client.command("exp", "updateTrial", {}, undefined, {
    recordHistory: false,
  });
  for (let i = 0; i < 60; i++) await client.undo("exp");
  expect(histories).toHaveLength(60);
  expect(client.canUndo("exp")).toBe(false);
  expect(await client.undo("exp")).toBe(null);
  expect(client.canRedo("exp")).toBe(true);
});
