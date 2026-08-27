export function getPersistenceCoordinatorRuntimeCode(): string {
  return `
  (() => {
    const pendingOperations = new Set();
    const idleWaiters = new Set();

    const notifyIfIdle = () => {
      if (pendingOperations.size > 0) return;
      for (const resolve of idleWaiters) resolve();
      idleWaiters.clear();
    };
    const start = () => {
      const token = Object.freeze({});
      pendingOperations.add(token);
      return token;
    };
    const finish = token => {
      pendingOperations.delete(token);
      notifyIfIdle();
    };

    window.ExpBuilderPersistence = Object.freeze({
      start,
      finish,
      track(operation) {
        const token = start();
        Promise.resolve(operation).then(
          () => finish(token),
          () => finish(token)
        );
        return operation;
      },
      pendingCount() {
        return pendingOperations.size;
      },
      async whenIdle() {
        while (pendingOperations.size > 0) {
          await new Promise(resolve => idleWaiters.add(resolve));
        }
      }
    });
  })();
`;
}
