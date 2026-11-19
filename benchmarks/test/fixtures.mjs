// Arithmetic fixtures, not a price quote or measurements of public persistence.
export const evidence = { provenance: 'assumed', source: 'Known arithmetic fixture' };
export function priceProfile() {
  return {
    id: 'arithmetic-fixture', currency: 'USD', basis: 'gross',
    sources: { fixture: { url: 'https://example.invalid/arithmetic-fixture', checkedAt: '2026-11-13' } },
    rates: {
      reads: { service: 'firestore', location: 'nam5', unit: 'count', per: 100000, price: '0.06', source: 'fixture' },
      writes: { service: 'firestore', location: 'nam5', unit: 'count', per: 100000, price: '0.18', source: 'fixture' },
      requests: { service: 'functions', location: 'us-central1', unit: 'count', per: 1000000, price: '0.40', source: 'fixture' },
      cpu: { service: 'functions', location: 'us-central1', unit: 'vCPU-second', per: 1, price: '0.000024', source: 'fixture' },
      memory: { service: 'functions', location: 'us-central1', unit: 'GiB-second', per: 1, price: '0.0000025', source: 'fixture' },
      scheduler: { service: 'scheduler', location: 'global', unit: 'job-day', per: 31, price: '0.10', source: 'fixture' },
    },
  };
}

export function fakeFirestore() {
  const records = new Map();
  let failCommit = false, retry = false;
  const snapshot = ref => ({ ref, exists: records.has(ref.path), data: () => records.get(ref.path) });
  const doc = path => {
    const ref = { path, collection: name => collection(path + '/' + name) };
    return Object.assign(ref, {
      get: async () => snapshot(ref),
      set: async data => records.set(path, data),
      update: async data => records.set(path, { ...records.get(path), ...data }),
      delete: async () => records.delete(path),
    });
  };
  const collection = (path, take = Infinity, after = '') => ({
    path, doc: id => doc(path + '/' + id),
    limit: count => collection(path, count, after),
    startAfter: ref => collection(path, take, ref.path),
    get: async () => {
      const docs = [...records.keys()].filter(key => key.startsWith(path + '/') && key > after)
        .sort().slice(0, take).map(key => snapshot(doc(key)));
      return { docs, size: docs.length, empty: !docs.length, forEach: callback => docs.forEach(callback) };
    },
    count: () => { throw new Error('The observer must reject unsupported aggregates before calling the SDK'); },
  });
  function transaction() {
    const operations = [];
    return {
      get: async ref => {
        if (operations.length) throw new Error('read after write');
        return ref.get();
      },
      set: (ref, value) => operations.push(() => ref.set(value)),
      update: (ref, value) => operations.push(() => ref.update(value)),
      delete: ref => operations.push(() => ref.delete()),
      commit: async () => {
        if (failCommit) { failCommit = false; throw new Error('commit unavailable'); }
        for (const operation of operations) await operation();
      },
    };
  }
  return { records, failNextCommit: () => { failCommit = true; }, retryNextTransaction: () => { retry = true; },
    db: { collection,
      batch: transaction,
      runTransaction: async callback => {
        if (retry) { retry = false; await callback(transaction()); }
        const tx = transaction(), result = await callback(tx);
        await tx.commit(); return result;
      },
    },
  };
}
