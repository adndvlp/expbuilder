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
  stimuliOrders: any[]; // Agregado
  categories: boolean;
  setCategories: React.Dispatch<React.SetStateAction<boolean>>;
  categoryColumn: string;
  setCategoryColumn: (col: string) => void;
  categoryData: any[]; // Agregado
  mapCategoriesFromCsv: (csvJson: any[], categoryColumn: string) => void;
  onSave?: (
    ord: boolean,
    ordCols: string[],
    stimOrd: any[],
    cat: boolean,
    catCol: string,
    catData: any[]
  ) => void; // Recibe valores directamente
};

function TrialOrders({
  orders,
  setOrders,
  columnOptions,
  orderColumns,
  setOrderColumns,
  mapOrdersFromCsv,
  csvJson,
  stimuliOrders,
  categories,
  setCategories,
  categoryColumn,
  setCategoryColumn,
  categoryData,
  mapCategoriesFromCsv,
  onSave,
}: Props) {
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cols = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setOrderColumns(cols);
    mapOrdersFromCsv(csvJson, cols);

    // Autoguardar pasando el nuevo valor directamente
    if (onSave) {
      setTimeout(
        () =>
          onSave(
            orders,
            cols,
            stimuliOrders,
            categories,
            categoryColumn,
            categoryData
          ),
        100
      );
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const column = e.target.value;
    setCategoryColumn(column);
    mapCategoriesFromCsv(csvJson, column);

    // Autoguardar pasando el nuevo valor directamente
    if (onSave) {
      setTimeout(
        () =>
          onSave(
            orders,
            orderColumns,
            stimuliOrders,
            categories,
            column,
            categoryData
          ),
        100
      );
    }
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
            onChange={(checked) => {
              setOrders(checked);
              if (onSave) {
                setTimeout(
                  () =>
                    onSave(
                      checked,
                      orderColumns,
                      stimuliOrders,
                      categories,
                      categoryColumn,
                      categoryData
                    ),
                  300
                );
              }
            }}
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
              {columnOptions && columnOptions.length > 0 ? (
                columnOptions.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))
              ) : (
                <option disabled>No columns available</option>
              )}
            </select>
          </div>
        )}
        <div
          className="ml-8"
          style={{ display: "flex", alignItems: "center", gap: "12px" }}
        >
          <Switch
            checked={categories}
            onChange={(checked) => {
              setCategories(checked);
              // Autoguardar pasando el nuevo valor directamente
              if (onSave) {
                setTimeout(
                  () =>
                    onSave(
                      orders,
                      orderColumns,
                      stimuliOrders,
                      checked,
                      categoryColumn,
                      categoryData
                    ),
                  300
                );
              }
            }}
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
              {columnOptions && columnOptions.length > 0 ? (
                columnOptions.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))
              ) : (
                <option disabled>No columns available</option>
              )}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrialOrders;
