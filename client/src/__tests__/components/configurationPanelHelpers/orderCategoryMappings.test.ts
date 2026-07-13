import {
  act,
  describe,
  expect,
  it,
  renderHook,
  useOrdersAndCategories,
} from "./testHarness";

describe("useOrdersAndCategories", () => {
  it("maps CSV order columns from 1-based rows to 0-based stimuli orders", () => {
    const { result } = renderHook(() => useOrdersAndCategories());

    act(() => {
      result.current.mapOrdersFromCsv(
        [
          { order_a: "1", order_b: 3 },
          { order_a: "2", order_b: "bad" },
          { order_a: "bad", order_b: 1 },
        ],
        ["order_a", "order_b"],
      );
    });

    expect(result.current.stimuliOrders).toEqual([
      [0, 1],
      [2, 0],
    ]);
  });

  it("maps and clears category data from CSV", () => {
    const { result } = renderHook(() => useOrdersAndCategories());

    act(() => {
      result.current.mapCategoriesFromCsv(
        [{ category: "practice" }, { category: "main" }],
        "category",
      );
    });

    expect(result.current.categoryData).toEqual(["practice", "main"]);

    act(() => {
      result.current.mapCategoriesFromCsv([], "category");
    });

    expect(result.current.categoryData).toEqual([]);
  });
});
