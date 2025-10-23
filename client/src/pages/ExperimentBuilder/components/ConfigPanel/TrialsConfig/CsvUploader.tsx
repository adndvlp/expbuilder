import React from "react";

type CsvUploaderProps = {
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  csvJson: any[];
  onDeleteCSV: () => void;
  disabled?: boolean;
};

function CsvUploader({
  onCsvUpload,
  csvJson,
  onDeleteCSV,
  disabled = false,
}: CsvUploaderProps) {
  return (
    <div className="mt-4 mb-4 p-4 border rounded bg-gray-50">
      <h4 className="font-bold mb-3">CSV or XLSX</h4>
      <label className="block mb-1 font-medium">
        Upload .csv or .xlsx file:
      </label>
      <input
        type="file"
        accept=".csv, .xlsx"
        onChange={onCsvUpload}
        disabled={disabled}
      />
      {csvJson.length > 0 && (
        <div className="mt-4">
          <h5 className="font-semibold">Data Preview:</h5>
          <div style={{ overflowX: "auto", maxHeight: "16rem" }}>
            <table
              className="min-w-full bg-white border"
              style={{ borderCollapse: "collapse", border: "2px solid black" }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      color: "black",
                      border: "1px solid black",
                      backgroundColor: "white",
                      padding: "0.5rem 0.25rem",
                      fontWeight: "bold",
                    }}
                  ></th>
                  {Object.keys(csvJson[0]).map((_, i) => (
                    <th
                      key={i}
                      style={{
                        color: "black",
                        border: "1px solid black",
                        backgroundColor: "white",
                        padding: "0.5rem 0.25rem",
                        fontWeight: "bold",
                      }}
                    >
                      {String.fromCharCode(65 + i)}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th
                    style={{
                      color: "black",
                      border: "1px solid black",
                      backgroundColor: "white",
                      padding: "0.5rem 0.25rem",
                      fontWeight: "bold",
                    }}
                  >
                    1
                  </th>
                  {Object.keys(csvJson[0]).map((key) => (
                    <th
                      key={key}
                      className="border px-2 py-1"
                      style={{
                        color: "black",
                        // border: "1px solid black",
                        backgroundColor: "white",
                        padding: "0.5rem 0.25rem",
                        fontWeight: "bold",
                      }}
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvJson.map((row, idx) => (
                  <tr key={idx}>
                    <td
                      style={{
                        color: "black",
                        border: "1px solid black",
                        backgroundColor: "white",
                        padding: "0.5rem 0.25rem",
                        fontWeight: "bold",
                      }}
                    >
                      {idx + 2}
                    </td>
                    {Object.values(row).map((val, i) => (
                      <td
                        key={i}
                        className="border px-2 py-1"
                        style={{
                          color: "black",
                          // border: "1px solid black",
                          padding: "0.5rem 0.25rem",
                        }}
                      >
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="text-white rounded remove-button mt-2"
            onClick={() => onDeleteCSV()}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default CsvUploader;
