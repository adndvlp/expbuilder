import { vi } from "vitest";

vi.mock("konva", () => ({ default: {} }));

const imageMockState = vi.hoisted(() => ({
  loaded: true,
}));

const konvaMockState = vi.hoisted(() => ({
  nullRefNames: new Set<string>(),
  activeAnchor: "middle-right" as string | undefined,
  scaleX: 1.4,
  scaleY: 1.3,
}));

vi.mock("use-image", () => ({
  default: (src?: string) =>
    src && imageMockState.loaded
      ? [
          {
            width: 120,
            height: 90,
            naturalWidth: 120,
            naturalHeight: 90,
          },
          "loaded",
        ]
      : [null, "unloaded"],
}));

vi.mock("../../../../pages/ExperimentBuilder/utils/mapFileToUrl", () => ({
  mapFileToUrl: (value: string) => `mapped/${value}`,
}));

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/snapKonvaNode",
  () => ({
    snapKonvaNode: ({ node, onGuidesChange }: any) => {
      onGuidesChange?.([{ orientation: "vertical", position: 100 }]);
      return { x: node.x(), y: node.y() };
    },
  }),
);

export { imageMockState, konvaMockState };
