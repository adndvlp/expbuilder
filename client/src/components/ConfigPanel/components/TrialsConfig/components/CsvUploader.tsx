import React from "react";

type CsvUploaderProps = {
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  csvJson: any[];
  onDeleteCSV: () => void;
};

const CsvUploader: React.FC<CsvUploaderProps> = ({
  onCsvUpload,
  csvJson,
  onDeleteCSV,
}) => (
  <div className="mt-4 mb-4 p-4 border rounded bg-gray-50">
    <h4 className="font-bold mb-3">CSV or XLSX</h4>
    <label className="block mb-1 font-medium">Upload .csv or .xlsx file:</label>
    <input type="file" accept=".csv, .xlsx" onChange={onCsvUpload} />
    {csvJson.length > 0 && (
      <div className="mt-4">
        <h5 className="font-semibold">JSON Data Preview:</h5>
        <pre
          className="bg-black p-2 rounded shadow-sm"
          style={{
            height: "16rem",
            overflowY: "auto",
          }}
        >
          {JSON.stringify(csvJson, null, 2)}
        </pre>
        <button
          className="text-white rounded remove-button"
          onClick={() => onDeleteCSV()}
        >
          Delete
        </button>
      </div>
    )}
  </div>
);

export default CsvUploader;
