import type { ParamsOverrideCondition } from "../../../types";

export function generateParamsOverrideCode(
  paramsOverride?: ParamsOverrideCondition[],
): string {
  if (!paramsOverride?.length) return "";

  return `
      const paramsOverrideConditions = ${JSON.stringify(paramsOverride)};
      const previousTrialData = jsPsych.data.get().values();
      const matchedOverride = paramsOverrideConditions.find(condition =>
        window.ExpBuilderBranching.evaluateReferencedCondition(
          previousTrialData,
          condition
        )
      );

      if (matchedOverride && matchedOverride.paramsToOverride) {
        const resolveOverrideValue = (param) => {
          if (param.source === 'typed') return param.value;
          if (param.source === 'csv') return trial[param.value];
          return undefined;
        };

        for (const [key, param] of Object.entries(matchedOverride.paramsToOverride)) {
          if (!param || param.source === 'none') continue;
          const valueToSet = resolveOverrideValue(param);
          if (valueToSet === undefined || valueToSet === null) continue;

          const parts = key.split('::');
          if (parts.length === 4) {
            const [fieldType, componentName, propName, questionName] = parts;
            const fieldArray = trial[fieldType];
            if (!Array.isArray(fieldArray) || propName !== 'survey_json') continue;
            const component = fieldArray.find(item => item.name === componentName);
            const elements = component?.survey_json?.elements || [];
            const question = elements.find(item => item.name === questionName);
            if (question) question.defaultValue = String(valueToSet);
            continue;
          }

          if (parts.length === 3) {
            const [fieldType, componentName, propName] = parts;
            const fieldArray = trial[fieldType];
            if (!Array.isArray(fieldArray)) continue;
            const component = fieldArray.find(item => item.name === componentName);
            if (component) component[propName] = valueToSet;
            continue;
          }

          trial[key] = valueToSet;
        }

        window.ExpBuilderRuntime?.emit('params-override', {
          conditionId: matchedOverride.id ?? null,
          keys: Object.keys(matchedOverride.paramsToOverride)
        });
      }
      `;
}
