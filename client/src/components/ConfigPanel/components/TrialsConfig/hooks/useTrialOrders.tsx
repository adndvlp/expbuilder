import { useState } from "react";

export function useTrialOrders() {
  const [orders, setOrders] = useState<boolean>(false);
  const [stimuliOrders, setStimuliOrders] = useState<any[]>([]);
  const [orderColumns, setOrderColumns] = useState<string[]>([]);

  // Mapea los valores del csvJson por columnas de orden
  function mapOrdersFromCsv(csvJson: any[], columnKeys: string[]) {
    const mapped = columnKeys.map((key) =>
      csvJson.map((row) => Number(row[key] - 1)).filter((v) => !isNaN(v))
    );
    setStimuliOrders(mapped);
  }

  return {
    orders,
    setOrders,
    stimuliOrders,
    setStimuliOrders,
    mapOrdersFromCsv,
    orderColumns,
    setOrderColumns,
  };
}
