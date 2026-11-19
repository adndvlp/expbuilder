export const deliveries = [];
export const getFunctions = () => ({ taskQueue: name => ({ enqueue: async (data, options = {}) => {
  deliveries.push({ name, data, due: options.scheduleTime?.getTime() || Date.now() });
} }) });
