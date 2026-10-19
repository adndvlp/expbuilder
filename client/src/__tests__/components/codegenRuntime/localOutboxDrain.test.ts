import { expect, it, vi } from "vitest";
import { buildLocalOutboxCode } from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/localOutboxCode";

vi.mock(
  "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/localOutboxDatabaseCode",
  () => ({
    buildLocalOutboxDatabaseCode: () => `
    async function initialize() {}
    async function listRecords() { return controls.read(); }
    async function saveRecord(record) { controls.save(record); }
    async function saveUnsavedRecords() {
      for (const record of unsavedRecords.values()) {
        await saveRecord(record);
        unsavedRecords.delete(record.key);
      }
    }
  `,
  }),
);

it("sends a result enqueued while the preceding flush is observing an empty queue", async () => {
  type Row = { sequence: number; status: string };
  const records = new Map<number, Row>();
  let releaseRead!: () => void;
  let emptyReadObserved!: () => void;
  const emptyRead = new Promise<void>((resolve) => {
    emptyReadObserved = resolve;
  });
  const readGate = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  let held = false;
  const controls = {
    save(record: Row) {
      records.set(record.sequence, JSON.parse(JSON.stringify(record)));
    },
    async read() {
      const snapshot = [...records.values()];
      if (
        !held &&
        snapshot.length === 1 &&
        snapshot[0].status === "acknowledged"
      ) {
        held = true;
        emptyReadObserved();
        await readGate;
      }
      return snapshot;
    },
  };
  const send = vi.fn(async (_url: string, request: { body: string }) => {
    const event = JSON.parse(request.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        eventId: event.eventId,
        sequence: event.sequence,
        storedCount: event.sequence + 1,
      }),
    };
  });
  const outbox = new Function(
    "window",
    "controls",
    "fetch",
    `
    ${buildLocalOutboxCode()}
    return _createLocalOutbox('experiment', 'session');
  `,
  )({}, controls, send);
  const acknowledged = vi.fn();
  outbox.onAcknowledged(acknowledged);
  const first = outbox.enqueue({ builder_id: "source" });
  await emptyRead;
  const second = outbox.enqueue({ builder_id: "branch-trigger" });
  // Drain the enqueue microtasks while the old read remains blocked.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(records.get(1)?.status).toBe("pending");
  releaseRead();
  await Promise.all([first, second]);

  expect(
    send.mock.calls.map(([, request]) => JSON.parse(request.body).sequence),
  ).toEqual([0, 1]);
  expect(acknowledged).toHaveBeenCalledTimes(2);
  expect(await outbox.stats()).toMatchObject({
    total: 2,
    acknowledged: 2,
    pending: 0,
  });
});
