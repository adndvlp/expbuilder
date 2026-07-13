import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/DynamicPluginPropertyColumn",
  () => ({
    DynamicPluginPropertyColumn: ({ componentIdx, comp }: any) => (
      <div data-testid="dynamic-property">
        {componentIdx}:{String(comp?.name ?? "none")}
      </div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/RuleValueInput",
  () => ({
    RuleValueInput: ({ rule }: any) => (
      <div data-testid="rule-value">{rule.value}</div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/RuleRow",
  () => ({
    RuleRow: ({ rule }: any) => (
      <td data-testid="params-rule-row">{String(rule.trialId ?? "")}</td>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ParameterOverrideRow",
  () => ({
    ParameterOverrideRow: ({ paramKey }: any) => (
      <td data-testid="params-override-row">{paramKey}</td>
    ),
  }),
);

export function renderTableRow(children: ReactNode) {
  return render(
    <table>
      <tbody>
        <tr>{children}</tr>
      </tbody>
    </table>,
  );
}
