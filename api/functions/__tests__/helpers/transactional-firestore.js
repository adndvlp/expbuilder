import { jest } from "@jest/globals";

// Transactional in-memory adapter: buffered writes, rollback on failure, and
// serial execution. It rejects reads after writes, like the Admin SDK.
export function makeTransactionalFirestore() {
  const records = new Map();
  let tail = Promise.resolve();
  let failure = null;
  let autoId = 0;
  let deleteFailure = null;
  const copy = value => value === undefined ? undefined : structuredClone(value);
  function validate(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value) && value.some(Array.isArray)) throw new Error('Firestore does not support nested arrays');
    Object.values(value).forEach(validate);
  }
  const snapshot = ref => ({ id: ref.id, ref, exists: records.has(ref.path), data: () => copy(records.get(ref.path)) });
  function write(ref, value, merge = false) {
    validate(value);
    const before = records.get(ref.path) ?? {};
    const resolved = Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      item?.__op === "increment" ? (before[key] ?? 0) + item.value : copy(item)]));
    records.set(ref.path, merge ? { ...before, ...resolved } : resolved);
  }
  function doc(path) {
    const ref = { path, id: path.split("/").at(-1), collection: name => collection(`${path}/${name}`) };
    ref.get = jest.fn(async () => snapshot(ref));
    ref.set = jest.fn(async (data, options) => write(ref, data, options?.merge));
    ref.update = jest.fn(async data => write(ref, data, true));
    ref.delete = jest.fn(async () => records.delete(path));
    return ref;
  }
  function query(select, filters = [], count = Infinity, order = null) {
    return { where: (field, operator, value) => query(select, [...filters, [field, operator, value]], count, order),
      limit: value => query(select, filters, value, order), orderBy: value => query(select, filters, count, value), get: async () => {
      let keys = [...records.keys()].filter(select).filter(key => filters.every(([field, operator, value]) => {
        const actual = records.get(key)[field];
        return operator === '==' ? actual === value : operator === '<=' ? actual <= value : operator === 'in' ? value.includes(actual) : false;
      }));
      keys.sort((a, b) => order ? records.get(a)[order] - records.get(b)[order] : a.localeCompare(b));
      const docs = keys.slice(0, count).map(key => snapshot(doc(key)));
      return { docs, empty: docs.length === 0, size: docs.length, forEach: cb => docs.forEach(cb) };
    } };
  }
  function collection(path) {
    return { path, doc: id => doc(`${path}/${id ?? `auto_${++autoId}`}`),
      ...query(key => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/')) };
  }
  function transaction() {
    const operations = [];
    return {
      get: async ref => { if (operations.length) throw new Error("Transaction read after write"); return typeof ref.doc === "function" ? ref.get() : snapshot(ref); },
      set: (ref, data, options) => { validate(data); operations.push(() => write(ref, data, options?.merge)); },
      update: (ref, data) => operations.push(() => write(ref, data, true)),
      delete: ref => {
        if (deleteFailure && ref.path.includes(deleteFailure.path)) {
          const error = deleteFailure.error; deleteFailure = null; throw error;
        }
        operations.push(() => records.delete(ref.path));
      },
      commit: async () => {
        if (failure) { const error = failure; failure = null; throw error; }
        for (const operation of operations) operation();
      },
    };
  }
  const db = { collection, collectionGroup: name => query(key => key.split('/').at(-2) === name),
    runTransaction: jest.fn(callback => {
      const result = tail.then(async () => { const tx = transaction(); const value = await callback(tx); await tx.commit(); return value; });
      tail = result.catch(() => {});
      return result;
    }),
    batch: () => transaction(),
  };
  return { db, records, failNextCommit: error => { failure = error; }, failNextDeleteOf: (path, error) => { deleteFailure = { path, error }; }, reset: () => {
    records.clear(); failure = null; deleteFailure = null; tail = Promise.resolve(); db.runTransaction.mockClear();
  } };
}
