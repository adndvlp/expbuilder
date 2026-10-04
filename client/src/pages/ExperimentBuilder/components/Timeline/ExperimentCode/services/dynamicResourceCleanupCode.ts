export const dynamicResourceCleanupCode = `
    if (typeof DynamicPlugin !== 'undefined' && typeof DynamicPlugin.dispose === 'function') {
      DynamicPlugin.dispose();
    }
`;
