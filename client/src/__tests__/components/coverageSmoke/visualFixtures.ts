import { vi } from "vitest";
import type { TrialComponent } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

export function nodeLike(x = 11, y = 22) {
  return {
    x: vi.fn(() => x),
    y: vi.fn(() => y),
    scaleX: vi.fn(() => 1),
    scaleY: vi.fn(() => 1),
    rotation: vi.fn(() => 5),
    getLayer: vi.fn(() => ({ batchDraw: vi.fn() })),
  };
}

function shape(type: TrialComponent["type"], config: Record<string, any> = {}) {
  return {
    id: `${type}-1`,
    type,
    x: 100,
    y: 120,
    width: 120,
    height: 70,
    rotation: 0,
    zIndex: 1,
    config,
  } as TrialComponent;
}

export function visualProps(
  type: TrialComponent["type"],
  config?: Record<string, any>,
) {
  return {
    shapeProps: shape(type, config),
    isSelected: true,
    onSelect: vi.fn(),
    onChange: vi.fn(),
    onSnap: vi.fn(() => null),
    onGuidesChange: vi.fn(),
    uploadedFiles: [{ name: "image.png", url: "uploads/img/image.png" }],
  };
}
