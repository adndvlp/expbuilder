import { vi } from "vitest";

export function fileEvent(file?: File) {
  return {
    target: { files: file ? [file] : [] },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

export function makeWorksheet() {
  const dateValue = new Date("2026-05-24T00:00:00.000Z");
  const headerRow = {
    eachCell: (callback: (cell: any, colNumber: number) => void) => {
      callback({ text: "stimulus" }, 1);
      callback({ text: "duration" }, 2);
      callback({ text: "when" }, 3);
      callback({ text: "score" }, 4);
    },
  };
  const dataRow = {
    eachCell: (callback: (cell: any, colNumber: number) => void) => {
      callback({ text: "A", value: "A", type: 3 }, 1);
      callback({ text: "500", value: 500, type: 2 }, 2);
      callback({ text: "5/24/2026", value: dateValue }, 3);
      callback(
        {
          text: "=1+1",
          value: { formula: "1+1", result: 2, date1904: false },
        },
        4,
      );
    },
  };
  const emptyRow = { eachCell: () => {} };

  return {
    getRow: vi.fn(() => headerRow),
    eachRow: vi.fn((callback: (row: any, rowNumber: number) => void) => {
      callback(headerRow, 1);
      callback(dataRow, 2);
      callback(emptyRow, 3);
    }),
  };
}
