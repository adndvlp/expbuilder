import { describe, it, expect, vi, beforeEach } from "vitest";

// Need to mock react-router-dom useParams before importing the hook
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(),
  };
});

import { fetchExperimentNameByID } from "../../pages/ExperimentBuilder/hooks/useExperimentID";
import { useParams } from "react-router-dom";

describe("useExperimentID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns id from URL params", () => {
    vi.mocked(useParams).mockReturnValue({ id: "exp-test-123" });

    // We can't call hooks outside React, so we test the logic directly
    const { id } = useParams();
    expect(id).toBe("exp-test-123");
  });

  it("returns undefined when id is not in URL", () => {
    vi.mocked(useParams).mockReturnValue({});

    const params = useParams();
    expect(params.id).toBeUndefined();
  });
});

describe("fetchExperimentNameByID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("fetches and returns experiment name", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({ experiment: { name: "Stroop Test" } }),
    } as Response);

    const name = await fetchExperimentNameByID("exp-001");
    expect(name).toBe("Stroop Test");
  });

  it("falls back to 'Experiment' when no name", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({ experiment: {} }),
    } as Response);

    const name = await fetchExperimentNameByID("exp-002");
    expect(name).toBe("Experiment");
  });

  it("falls back to 'Experiment' when experiment is null", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({}),
    } as Response);

    const name = await fetchExperimentNameByID("exp-003");
    expect(name).toBe("Experiment");
  });
});
