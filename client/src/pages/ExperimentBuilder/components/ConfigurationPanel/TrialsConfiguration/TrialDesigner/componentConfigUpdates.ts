import { TrialComponent } from "./types";
import { restoreStyleFields } from "./syncConfigToComponent";

export type ConfigPatch = Record<string, any>;

export function typedValue(value: any) {
  return { source: "typed" as const, value };
}

export function applyComponentConfigPatch(
  component: TrialComponent,
  patch: ConfigPatch,
  visualPatch: Partial<TrialComponent> = {},
): TrialComponent {
  return restoreStyleFields({
    ...component,
    ...visualPatch,
    config: {
      ...component.config,
      ...patch,
    },
  });
}
