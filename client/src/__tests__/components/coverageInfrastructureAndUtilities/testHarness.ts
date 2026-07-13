import { afterEach, vi } from "vitest";
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("../../../lib/firebase");
  vi.unstubAllEnvs();
  delete (window as any).electron;
  document.body.innerHTML = "";
});

function sampleComponent(
  overrides: Partial<TrialComponent> = {},
): TrialComponent {
  return {
    id: "text-1",
    type: "TextComponent",
    x: 10,
    y: 20,
    width: 100,
    height: 40,
    rotation: 0,
    zIndex: 2,
    config: {
      name: { source: "typed", value: "Title" },
    },
    ...overrides,
  } as TrialComponent;
}

export { sampleComponent };
