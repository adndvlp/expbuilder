import {
  OrdersAndCategories,
  afterEach,
  beforeEach,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
} from "./testHarness";

describe("coverage configuration: webgazer and configuration primitives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates mappings without scheduling saves when onSave is absent", () => {
    const setOrders = vi.fn();
    const setOrderColumns = vi.fn();
    const mapOrdersFromCsv = vi.fn();
    const setCategories = vi.fn();
    const setCategoryColumn = vi.fn();
    const mapCategoriesFromCsv = vi.fn();
    render(
      <OrdersAndCategories
        orders
        setOrders={setOrders}
        columnOptions={["order_a", "category"]}
        orderColumns={["order_a"]}
        setOrderColumns={setOrderColumns}
        mapOrdersFromCsv={mapOrdersFromCsv}
        csvJson={[{ order_a: 1, category: "easy" }]}
        stimuliOrders={[[0]]}
        categories
        setCategories={setCategories}
        categoryColumn="category"
        setCategoryColumn={setCategoryColumn}
        categoryData={["easy"]}
        mapCategoriesFromCsv={mapCategoriesFromCsv}
      />,
    );

    const orderSelect = screen.getByLabelText(
      "Select order columns:",
    ) as HTMLSelectElement;
    orderSelect.options[0].selected = false;
    fireEvent.change(orderSelect);
    fireEvent.change(screen.getByLabelText("Select category column:"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getAllByRole("switch")[0]);
    fireEvent.click(screen.getAllByRole("switch")[1]);

    expect(setOrderColumns).toHaveBeenCalledWith([]);
    expect(mapOrdersFromCsv).toHaveBeenCalledWith(
      [{ order_a: 1, category: "easy" }],
      [],
    );
    expect(setCategoryColumn).toHaveBeenCalledWith("");
    expect(mapCategoriesFromCsv).toHaveBeenCalledWith(
      [{ order_a: 1, category: "easy" }],
      "",
    );
  });

  it("preserves configured mappings when switches are enabled", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const setOrderColumns = vi.fn();
    const setCategoryColumn = vi.fn();
    render(
      <OrdersAndCategories
        orders={false}
        setOrders={vi.fn()}
        columnOptions={["order_a", "category"]}
        orderColumns={["order_a"]}
        setOrderColumns={setOrderColumns}
        mapOrdersFromCsv={vi.fn()}
        csvJson={[{ order_a: 1, category: "easy" }]}
        stimuliOrders={[[0]]}
        categories={false}
        setCategories={vi.fn()}
        categoryColumn="category"
        setCategoryColumn={setCategoryColumn}
        categoryData={["easy"]}
        mapCategoriesFromCsv={vi.fn()}
        onSave={onSave}
      />,
    );

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    vi.advanceTimersByTime(300);

    expect(setOrderColumns).not.toHaveBeenCalled();
    expect(setCategoryColumn).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith(
      true,
      ["order_a"],
      [[0]],
      false,
      "category",
      ["easy"],
    );
    expect(onSave).toHaveBeenCalledWith(
      false,
      ["order_a"],
      [[0]],
      true,
      "category",
      ["easy"],
    );
  });
});
