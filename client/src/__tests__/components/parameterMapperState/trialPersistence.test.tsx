import {
  act,
  afterEach,
  describe,
  expect,
  it,
  renderHook,
  useTrialPersistenceHarness,
  vi,
  waitFor,
} from "./testHarness";

describe("useTrialPersistence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes the selected trial recursively and clears branch references before deleting from the API", () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);

    const { result } = renderHook(() =>
      useTrialPersistenceHarness({
        initialSelectedTrial: { id: 2, name: "Delete me" },
        initialTrials: [
          { id: 1, name: "Root", branches: [2, "2", 3] },
          { id: 2, name: "Delete me" },
          {
            id: "loop_1",
            name: "Loop",
            branches: [2, "4"],
            trials: [
              { id: 2, name: "Nested delete me" },
              { id: 4, name: "Nested keep", branches: [2, "2", 5] },
            ],
          },
          { id: 5, name: "No branches" },
        ],
      }),
    );

    act(() => result.current.handleDeleteTrial());

    expect(result.current.trials).toEqual([
      { id: 1, name: "Root", branches: [3] },
      {
        id: "loop_1",
        name: "Loop",
        branches: ["4"],
        trials: [{ id: 4, name: "Nested keep", branches: [5] }],
      },
      { id: 5, name: "No branches" },
    ]);
    expect(result.current.selectedTrial).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/trials/2/test-exp-123",
      { method: "DELETE" },
    );
  });

  it("does nothing when no trial is selected", () => {
    globalThis.fetch = vi.fn();

    const initialTrials = [{ id: 1, name: "Root" }];
    const { result } = renderHook(() =>
      useTrialPersistenceHarness({
        initialSelectedTrial: null,
        initialTrials,
      }),
    );

    act(() => result.current.handleDeleteTrial());

    expect(result.current.trials).toBe(initialTrials);
    expect(result.current.selectedTrial).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("logs API delete failures after removing the selected trial locally", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() =>
      useTrialPersistenceHarness({
        initialSelectedTrial: { id: 2, name: "Delete me" },
        initialTrials: [{ id: 2, name: "Delete me" }],
      }),
    );

    act(() => result.current.handleDeleteTrial());

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error deleting trial:",
        expect.any(Error),
      );
    });
  });
});
