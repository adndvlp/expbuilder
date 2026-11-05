import { jest } from "@jest/globals";

// Serialized transactions with staged writes: losing a reservation cannot leak writes.
export function makeExperimentStore() {
  const documents = new Map();
  const changes = [];
  let pending = Promise.resolve();
  const clone = (value) =>
    value === undefined ? undefined : structuredClone(value);
  function snapshot(ref) {
    const value = clone(documents.get(ref.path));
    return {
      exists: value !== undefined,
      id: ref.id,
      ref,
      data: () => clone(value),
    };
  }
  function write(ref, value, merge = false) {
    const previous = documents.get(ref.path) || {};
    documents.set(ref.path, clone(merge ? { ...previous, ...value } : value));
    changes.push(ref.path);
  }
  function ref(path) {
    return {
      path,
      id: path.split("/").at(-1),
      get: async () => snapshot(ref(path)),
      set: async (value, options) => write(ref(path), value, options?.merge),
      update: async (value) => write(ref(path), value, true),
      create: async (value) => {
        if (documents.has(path))
          throw Object.assign(new Error("ALREADY_EXISTS"), { code: 6 });
        write(ref(path), value);
      },
      delete: async () => {
        documents.delete(path);
        changes.push(path);
      },
      collection: (name) => collection(`${path}/${name}`),
    };
  }
  function collection(path) {
    const value = {
      doc: (id = `auto-${documents.size}`) => ref(`${path}/${id}`),
      get: async () => {
        const docs = [...documents.keys()]
          .filter(
            (key) =>
              key.startsWith(`${path}/`) &&
              !key.slice(path.length + 1).includes("/"),
          )
          .map((key) => snapshot(ref(key)));
        return { docs, empty: !docs.length, size: docs.length };
      },
      limit: () => value,
    };
    return value;
  }
  const db = {
    collection,
    batch: () => {
      const ops = [];
      return {
        delete: (r) => ops.push(() => r.delete()),
        commit: async () => Promise.all(ops.map((f) => f())),
      };
    },
    runTransaction: jest.fn((work) => {
      const run = pending.then(async () => {
        const writes = [];
        const result = await work({
          get: async (r) => snapshot(r),
          create: (r, data) => writes.push(() => r.create(data)),
          set: (r, data, options) => writes.push(() => r.set(data, options)),
          update: (r, data) => writes.push(() => r.update(data)),
          delete: (r) => writes.push(() => r.delete()),
        });
        for (const apply of writes) await apply();
        return result;
      });
      pending = run.catch(() => {});
      return run;
    }),
  };
  return {
    db,
    documents,
    changes,
    seed: (path, value) => documents.set(path, clone(value)),
    read: (path) => clone(documents.get(path)),
    reset() {
      documents.clear();
      changes.length = 0;
      db.runTransaction.mockClear();
    },
  };
}
