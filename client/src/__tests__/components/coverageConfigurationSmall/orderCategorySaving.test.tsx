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

  it("maps order and category columns before saving", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const onSave = vi.fn();
    const setOrderColumns = vi.fn();
    const mapOrdersFromCsv = vi.fn();
    const setCategoryColumn = vi.fn();
    const mapCategoriesFromCsv = vi.fn();
    render(
      <OrdersAndCategories
        orders
        setOrders={vi.fn()}
        columnOptions={["order_a", "category"]}
        orderColumns={[]}
        setOrderColumns={setOrderColumns}
        mapOrdersFromCsv={mapOrdersFromCsv}
        csvJson={[
          { order_a: 1, category: "easy" },
          { order_a: 3, category: "hard" },
        ]}
        stimuliOrders={[]}
        categories
        setCategories={vi.fn()}
        categoryColumn=""
        setCategoryColumn={setCategoryColumn}
        categoryData={[]}
        mapCategoriesFromCsv={mapCategoriesFromCsv}
        onSave={onSave}
      />,
    );

    const orderSelect = screen.getByLabelText(
      "Select order columns:",
    ) as HTMLSelectElement;
    orderSelect.options[0].selected = true;
    fireEvent.change(orderSelect);
    vi.advanceTimersByTime(100);
    expect(setOrderColumns).toHaveBeenCalledWith(["order_a"]);
    expect(mapOrdersFromCsv).toHaveBeenCalledWith(
      [
        { order_a: 1, category: "easy" },
        { order_a: 3, category: "hard" },
      ],
      ["order_a"],
    );
    expect(onSave).toHaveBeenCalledWith(
      true,
      ["order_a"],
      [[0, 2]],
      true,
      "",
      [],
    );

    fireEvent.change(screen.getByLabelText("Select category column:"), {
      target: { value: "category" },
    });
    vi.advanceTimersByTime(100);
    expect(setCategoryColumn).toHaveBeenCalledWith("category");
    expect(mapCategoriesFromCsv).toHaveBeenCalledWith(
      [
        { order_a: 1, category: "easy" },
        { order_a: 3, category: "hard" },
      ],
      "category",
    );
    expect(onSave).toHaveBeenCalledWith(true, [], [], true, "category", [
      "easy",
      "hard",
    ]);
  });

  it("clears order and category mappings when their switches are disabled", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
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
        columnOptions={[]}
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
        onSave={onSave}
      />,
    );

    expect(screen.getAllByText("No columns available")).toHaveLength(2);

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    vi.advanceTimersByTime(300);
    expect(setOrders).toHaveBeenCalledWith(false);
    expect(setOrderColumns).toHaveBeenCalledWith([]);
    expect(mapOrdersFromCsv).toHaveBeenCalledWith(
      [{ order_a: 1, category: "easy" }],
      [],
    );
    expect(onSave).toHaveBeenCalledWith(false, [], [], true, "category", [
      "easy",
    ]);

    fireEvent.click(switches[1]);
    vi.advanceTimersByTime(300);
    expect(setCategories).toHaveBeenCalledWith(false);
    expect(setCategoryColumn).toHaveBeenCalledWith("");
    expect(mapCategoriesFromCsv).toHaveBeenCalledWith(
      [{ order_a: 1, category: "easy" }],
      "",
    );
    expect(onSave).toHaveBeenCalledWith(
      true,
      ["order_a"],
      [[0]],
      false,
      "",
      [],
    );
  });
});
