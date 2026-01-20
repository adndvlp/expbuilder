import { useState } from "react";
import Papa from "papaparse";
import * as ExcelJS from "exceljs";

export function useCsvData() {
  const [csvJson, setCsvJson] = useState<any[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);

  const handleCsvUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onDataLoaded?: (data: any[], columns: string[]) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const newData = results.data;
          const newColumns =
            results.data.length > 0
              ? Object.keys(results.data[0] as Record<string, any>)
              : [];

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
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);

        // Get the first worksheet
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
          alert("No worksheet found in the Excel file");
          return;
        }

        const jsonData: any[] = [];
        const headers: string[] = [];

        // Get headers from the first row
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = cell.text || `Column${colNumber}`;
        });
        // Process data rows (starting from row 2)
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row

          const rowData: Record<string, any> = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1];
            if (header) {
              // Handle different cell types
              let value = cell.value;
              if (cell.type === ExcelJS.ValueType.Date) {
                value = cell.value; // Keep as Date object or format as needed
              } else if (cell.type === ExcelJS.ValueType.Formula) {
                value = cell.result || cell.text;
              } else {
                value = cell.text || "";
              }
              rowData[header] = value;
            }
          });

          // Only add rows that have some data
          if (
            Object.values(rowData).some(
              (val) => val !== "" && val !== null && val !== undefined
            )
          ) {
            jsonData.push(rowData);
          }
        });

        const newColumns = headers.filter((header) => header);
        setCsvJson(jsonData);
        setCsvColumns(newColumns); // Remove empty headers

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
