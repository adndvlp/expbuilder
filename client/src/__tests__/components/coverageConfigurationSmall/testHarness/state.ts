import { vi } from "vitest";

const asyncMocks = vi.hoisted(() => ({
  fetchExperimentNameByID: vi.fn(async () => "Loaded Experiment"),
}));

export { asyncMocks };
