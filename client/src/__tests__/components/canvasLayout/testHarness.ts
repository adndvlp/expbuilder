import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { useFlowLayout } from "../../../pages/ExperimentBuilder/components/Canvas/hooks/useFlowLayout";

export function renderFlowLayout(
  timeline: any[],
  overrides: Record<string, unknown> = {},
) {
  return renderHook(() =>
    useFlowLayout({
      timeline,
      selectedTrial: null,
      selectedLoop: null,
      onSelectTrial: vi.fn(),
      onSelectLoop: vi.fn(),
      onAddBranch: vi.fn(),
      onOpenLoop: vi.fn(),
      ...overrides,
    }),
  );
}
