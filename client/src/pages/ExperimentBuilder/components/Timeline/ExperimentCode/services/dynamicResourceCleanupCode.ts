export const dynamicResourceCleanupCode = `
    window.ExpBuilderMediaPreparation?.dispose();
    if (typeof DynamicPlugin !== 'undefined' && typeof DynamicPlugin.dispose === 'function') {
      DynamicPlugin.dispose();
    }
`;
