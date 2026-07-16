import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import {
  useExpandedLoopPath,
  type ExpandedLoopReference,
  type LoadLoopItems,
} from "../../../pages/ExperimentBuilder/components/Canvas/hooks/useExpandedLoopPath";

export const trialItem = (id: string): TimelineItem => ({
  id,
  type: "trial",
  name: `Trial ${id}`,
});

export const loopReference = (
  id: string,
  name = `Loop ${id}`,
): ExpandedLoopReference => ({ id, name });

export const setupExpandedLoopPath = () => {
  const loadLoopItems = vi.fn<LoadLoopItems>();
  const activateRoot = vi
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);
  const hook = renderHook(() =>
    useExpandedLoopPath({ loadLoopItems, activateRoot }),
  );

  return { ...hook, loadLoopItems, activateRoot };
};

export const pathIds = (
  path: ReturnType<
    typeof setupExpandedLoopPath
  >["result"]["current"]["expandedPath"],
) => path.map((entry) => entry.loop.id);
