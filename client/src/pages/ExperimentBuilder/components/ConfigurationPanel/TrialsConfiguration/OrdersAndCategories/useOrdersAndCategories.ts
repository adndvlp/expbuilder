import { useState } from "react";

export function useOrdersAndCategories() {
  const [orders, setOrders] = useState<boolean>(false);
  const [stimuliOrders, setStimuliOrders] = useState<any[]>([]);
  const [orderColumns, setOrderColumns] = useState<string[]>([]);
  const [categories, setCategories] = useState<boolean>(false);
  const [categoryColumn, setCategoryColumn] = useState<string>("");
  const [categoryData, setCategoryData] = useState<any[]>([]);

  // Mapea los valores del csvJson por columnas de orden
  function mapOrdersFromCsv(csvJson: any[], columnKeys: string[]) {
    const mapped = columnKeys.map((key) =>
      csvJson.map((row) => Number(row[key] - 1)).filter((v) => !isNaN(v)),
    );
    setStimuliOrders(mapped);
  }

  function mapCategoriesFromCsv(csvJson: any[], categoryColumn: string) {
    if (categoryColumn && csvJson.length > 0) {
      const categories = csvJson.map((row) => row[categoryColumn]);
      setCategoryData(categories);
    } else {
      setCategoryData([]);
    }
  }

  return {
    orders,
    setOrders,
    stimuliOrders,
    setStimuliOrders,
    mapOrdersFromCsv,
    orderColumns,
    setOrderColumns,
    categories,
    setCategories,
    categoryColumn,
    setCategoryColumn,
    categoryData,
    setCategoryData,
    mapCategoriesFromCsv,
  };
}
