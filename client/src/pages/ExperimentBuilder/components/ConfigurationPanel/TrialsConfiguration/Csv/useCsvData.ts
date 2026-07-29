import { useState } from "react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file/browser";

export type CsvRow = Record<string, unknown>;

function getExcelHeader(value: unknown, columnIndex: number): string {
  if (value === null || value === undefined || value === "") {
    return `Column${columnIndex + 1}`;
  }
  return value instanceof Date ? value.toISOString() : String(value);
}

export function useCsvData() {
  const [csvJson, setCsvJson] = useState<CsvRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);

  const handleCsvUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onDataLoaded?: (data: CsvRow[], columns: string[]) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const newData = results.data as CsvRow[];
          const newColumns = newData.length > 0 ? Object.keys(newData[0]) : [];

          setCsvJson(newData);
          setCsvColumns(newColumns);

          if (onDataLoaded) {
            onDataLoaded(newData, newColumns);
          }
        },
        error: (err) => {
          alert("Error at reading the CSV: " + err.message);
        },
      });
    } else if (fileName.endsWith(".xlsx")) {
      try {
        const [firstWorksheet] = await readXlsxFile(file);
        if (!firstWorksheet) {
          alert("No worksheet found in the Excel file");
          return;
        }

        const [headerRow = [], ...dataRows] = firstWorksheet.data;
        const newColumns = headerRow.map(getExcelHeader);
        const jsonData = dataRows
          .map((row) =>
            Object.fromEntries(
              newColumns.map((header, columnIndex) => [
                header,
                row[columnIndex] ?? "",
              ]),
            ),
          )
          .filter((row) =>
            Object.values(row).some(
              (value) => value !== "" && value !== null && value !== undefined,
            ),
          );

        setCsvJson(jsonData);
        setCsvColumns(newColumns);

        if (onDataLoaded) {
          onDataLoaded(jsonData, newColumns);
        }
      } catch (error) {
        console.error("Error reading Excel file:", error);
        alert("Error reading the Excel file. Please check the file format.");
      }
    } else {
      alert("Not supported format. Upload a .csv or .xlsx file");
    }
  };

  return {
    csvJson,
    setCsvJson,
    csvColumns,
    setCsvColumns,
    handleCsvUpload,
  };
}
