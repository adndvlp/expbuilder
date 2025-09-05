type Props = {
  orders: boolean;
  setOrders: React.Dispatch<React.SetStateAction<boolean>>;
  columnOptions: string[]; // Las columnas disponibles
  orderColumns: string[]; // Las columnas seleccionadas
  setOrderColumns: (cols: string[]) => void;
  mapOrdersFromCsv: (csvJson: any[], columnKeys: string[]) => void; // <-- agrega esta prop
  csvJson: any[];
};

function TrialOrders({
  orders,
  setOrders,
  columnOptions,
  orderColumns,
  setOrderColumns,
  mapOrdersFromCsv,
  csvJson,
}: Props) {
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cols = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setOrderColumns(cols);
    mapOrdersFromCsv(csvJson, cols);
  };
  return (
    <div className="mb-4 p-4 border rounded bg-gray-50">
      <div className="flex items-center">
        <div>
          <h6>Set orders</h6>
          <input
            type="checkbox"
            checked={orders}
            onChange={(e) => setOrders(e.target.checked)}
          />
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
      </div>
    </div>
  );
}

export default TrialOrders;
