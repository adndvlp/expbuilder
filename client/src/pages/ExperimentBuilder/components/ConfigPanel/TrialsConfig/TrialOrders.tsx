import React from "react";
import Switch from "react-switch";

type Props = {
  orders: boolean;
  setOrders: React.Dispatch<React.SetStateAction<boolean>>;
  columnOptions: string[]; // Las columnas disponibles
  orderColumns: string[]; // Las columnas seleccionadas
  setOrderColumns: (cols: string[]) => void;
  mapOrdersFromCsv: (csvJson: any[], columnKeys: string[]) => void;
  csvJson: any[];
  categories: boolean;
  setCategories: React.Dispatch<React.SetStateAction<boolean>>;
  categoryColumn: string;
  setCategoryColumn: (col: string) => void;
  mapCategoriesFromCsv: (csvJson: any[], categoryColumn: string) => void;
};

function TrialOrders({
  orders,
  setOrders,
  columnOptions,
  orderColumns,
  setOrderColumns,
  mapOrdersFromCsv,
  csvJson,
  categories,
  setCategories,
  categoryColumn,
  setCategoryColumn,
  mapCategoriesFromCsv,
}: Props) {
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cols = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setOrderColumns(cols);
    mapOrdersFromCsv(csvJson, cols);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const column = e.target.value;
    setCategoryColumn(column);
    mapCategoriesFromCsv(csvJson, column); // Agregar esta línea
  };

  return (
    <div className="mb-4 p-4 border rounded bg-gray-50">
      <div className="flex items-center">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: 10,
          }}
        >
          <Switch
            checked={orders}
            onChange={(checked) => setOrders(checked)}
            onColor="#f1c40f"
            onHandleColor="#ffffff"
            handleDiameter={24}
            uncheckedIcon={false}
            checkedIcon={false}
            height={20}
            width={44}
          />
          <h6 style={{ margin: 0 }}>Set orders</h6>
        </div>
        {orders && (
          <div className="ml-4">
            <label htmlFor="order-columns">Select order columns:</label>
            <select
              id="order-columns"
              multiple
              value={orderColumns}
              onChange={handleSelectChange}
              className="ml-2"
            >
              {columnOptions.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        )}
        <div
          className="ml-8"
          style={{ display: "flex", alignItems: "center", gap: "12px" }}
        >
          <Switch
            checked={categories}
            onChange={(checked) => setCategories(checked)}
            onColor="#f1c40f"
            onHandleColor="#ffffff"
            handleDiameter={24}
            uncheckedIcon={false}
            checkedIcon={false}
            height={20}
            width={44}
          />
          <h6 style={{ margin: 0 }}>Set category column</h6>
        </div>
        {categories && (
          <div className="ml-4">
            <label htmlFor="category-column">Select category column:</label>
            <select
              id="category-column"
              value={categoryColumn}
              onChange={handleCategoryChange}
              className="ml-2"
            >
              <option value="">Select</option>
              {columnOptions.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrialOrders;
