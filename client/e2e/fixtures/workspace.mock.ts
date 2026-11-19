import type { Page, Route } from "@playwright/test";
import type { WorkspaceDocument } from "../../../shared/experiment-workspace/dist/types.js";
import { executeWorkspaceCommand } from "../../../server/routes/workspace/executeCommand.js";
import { workspaceSnapshot } from "../../../server/routes/workspace/snapshot.js";
import { workspaceRecords } from "../../../server/routes/workspace/records.js";

const fixtures = new WeakMap<Page, ReturnType<typeof createWorkspaceFixture>>();

function createWorkspaceFixture() {
  const data = {
    experiments: [] as { experimentID: string }[],
    trials: [] as WorkspaceDocument[],
    mutationReceipts: [],
  };
  const document = (id: string) => {
    let doc = data.trials.find((item) => item.experimentID === id);
    if (!doc) {
      doc = {
        experimentID: id,
        workspaceSchemaVersion: 2,
        entryItemId: null,
        authoringRevision: "1",
        timeline: [],
        trials: [],
        loops: [],
      };
      data.experiments.push({ experimentID: id });
      data.trials.push(doc);
    }
    return doc;
  };
  const seed = (doc: WorkspaceDocument) => {
    const index = data.trials.indexOf(document(doc.experimentID));
    data.trials[index] = structuredClone(doc);
    data.mutationReceipts = [];
  };
  const handle = async (route: Route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(
      /^\/api\/workspace\/([^/]+)(?:\/(commands|records))?$/,
    );
    if (!match) return false;
    const id = decodeURIComponent(match[1]);
    const doc = document(id);
    try {
      let result;
      if (match[2] === "commands" && route.request().method() === "POST") {
        result = executeWorkspaceCommand(
          data,
          id,
          route.request().postDataJSON(),
          route.request().headers()["idempotency-key"],
        );
      } else if (match[2] === "records") {
        if (
          url.searchParams.has("revision") &&
          url.searchParams.get("revision") !== String(doc.authoringRevision)
        ) {
          await route.fulfill({
            status: 409,
            json: {
              code: "REVISION_CONFLICT",
              error: "The workspace revision changed",
            },
          });
          return true;
        }
        result = {
          success: true,
          revision: String(doc.authoringRevision),
          records: workspaceRecords(
            doc,
            new Set((url.searchParams.get("ids") ?? "").split(",")),
          ),
        };
      } else if (route.request().method() === "GET" && !match[2]) {
        result = workspaceSnapshot(doc);
      } else {
        await route.fulfill({
          status: 405,
          json: { error: "Unsupported workspace fixture request" },
        });
        return true;
      }
      await route.fulfill({ json: result });
    } catch (error) {
      const failure = error as Error & {
        status?: number;
        code?: string;
        levels?: unknown;
      };
      await route.fulfill({
        status: failure.status ?? 400,
        json: {
          success: false,
          error: failure.message,
          code: failure.code,
          levels: failure.levels,
        },
      });
    }
    return true;
  };
  return {
    document,
    seed,
    handle,
    response: (id: string) => workspaceSnapshot(document(id)),
  };
}

export function setupWorkspaceFixture(page: Page) {
  const fixture = createWorkspaceFixture();
  fixtures.set(page, fixture);
  return fixture;
}

export function workspaceFixture(page: Page) {
  const fixture = fixtures.get(page);
  if (!fixture)
    throw new Error("The workspace API fixture has not been installed");
  return fixture;
}
