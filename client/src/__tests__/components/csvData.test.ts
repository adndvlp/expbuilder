import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file/browser";
import { useCsvData } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Csv/useCsvData";
import { fileEvent } from "./csvData/fixtures";

vi.mock("papaparse", () => ({
  default: {
    parse: vi.fn(),
  },
}));

vi.mock("read-excel-file/browser", () => ({
  default: vi.fn(),
}));

describe("useCsvData", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("ignores upload events without files", async () => {
    const onDataLoaded = vi.fn();
    const { result } = renderHook(() => useCsvData());

    await act(async () => {
      await result.current.handleCsvUpload(fileEvent(), onDataLoaded);
    });

    expect(Papa.parse).not.toHaveBeenCalled();
    expect(onDataLoaded).not.toHaveBeenCalled();
    expect(result.current.csvJson).toEqual([]);
    expect(result.current.csvColumns).toEqual([]);
  });

  it("loads CSV rows and derives columns from the first row", async () => {
    vi.mocked(Papa.parse).mockImplementation((_file: unknown, config: any) => {
      config.complete({
        data: [
          { stimulus: "A", duration: "500" },
          { stimulus: "B", duration: "750" },
        ],
      });
      return {} as any;
    });
    const onDataLoaded = vi.fn();
    const { result } = renderHook(() => useCsvData());

    await act(async () => {
      await result.current.handleCsvUpload(
        fileEvent(new File(["stimulus,duration"], "trials.csv")),
        onDataLoaded,
      );
    });

    expect(Papa.parse).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({
        header: true,
        skipEmptyLines: true,
      }),
    );
    expect(result.current.csvJson).toEqual([
      { stimulus: "A", duration: "500" },
      { stimulus: "B", duration: "750" },
    ]);
    expect(result.current.csvColumns).toEqual(["stimulus", "duration"]);
    expect(onDataLoaded).toHaveBeenCalledWith(
      [
        { stimulus: "A", duration: "500" },
        { stimulus: "B", duration: "750" },
      ],
      ["stimulus", "duration"],
    );
  });

  it("loads an empty CSV without a callback", async () => {
    vi.mocked(Papa.parse).mockImplementation((_file: unknown, config: any) => {
      config.complete({ data: [] });
      return {} as any;
    });
    const { result } = renderHook(() => useCsvData());

    await act(async () => {
      await result.current.handleCsvUpload(
        fileEvent(new File(["stimulus"], "empty.csv")),
      );
    });

    expect(result.current.csvJson).toEqual([]);
    expect(result.current.csvColumns).toEqual([]);
  });

  it("alerts on CSV parser errors without mutating state", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.mocked(Papa.parse).mockImplementation((_file: unknown, config: any) => {
      config.error({ message: "bad csv" });
      return {} as any;
    });
    const { result } = renderHook(() => useCsvData());

    await act(async () => {
      await result.current.handleCsvUpload(
        fileEvent(new File(["x"], "bad.csv")),
      );
    });

    expect(alertSpy).toHaveBeenCalledWith("Error at reading the CSV: bad csv");
    expect(result.current.csvJson).toEqual([]);
    expect(result.current.csvColumns).toEqual([]);
  });

  it("loads XLSX first worksheet rows and skips empty rows", async () => {
    vi.mocked(readXlsxFile).mockResolvedValue([
      {
        sheet: "Trials",
        data: [
          ["stimulus", "duration", "when", "score"],
          ["A", "500", new Date("2026-05-24T00:00:00.000Z"), 2],
          [null, null, null, null],
        ],
      },
    ]);
    const onDataLoaded = vi.fn();
    const { result } = renderHook(() => useCsvData());

    await act(async () => {
      await result.current.handleCsvUpload(
        fileEvent(new File([new Uint8Array([1])], "trials.xlsx")),
        onDataLoaded,
      );
    });

    expect(readXlsxFile).toHaveBeenCalledWith(expect.any(File));
    expect(result.current.csvJson).toEqual([
      {
        stimulus: "A",
        duration: "500",
        when: new Date("2026-05-24T00:00:00.000Z"),
        score: 2,
      },
    ]);
    expect(result.current.csvColumns).toEqual([
      "stimulus",
      "duration",
      "when",
      "score",
    ]);
    expect(onDataLoaded).toHaveBeenCalledWith(
      [
        {
          stimulus: "A",
          duration: "500",
          when: new Date("2026-05-24T00:00:00.000Z"),
          score: 2,
        },
      ],
      ["stimulus", "duration", "when", "score"],
    );
  });

  it("uses Excel header and cell fallbacks without a callback", async () => {
    vi.mocked(readXlsxFile).mockResolvedValue([
      {
        sheet: "Fallbacks",
        data: [
          [null, "formula", "plain", "ignored"],
          [null, "fallback", null, 0, "no header"],
        ],
      },
    ]);
    const { result } = renderHook(() => useCsvData());

    await act(async () => {
      await result.current.handleCsvUpload(
        fileEvent(new File([new Uint8Array([1])], "fallbacks.xlsx")),
      );
    });

    expect(result.current.csvColumns).toEqual([
      "Column1",
      "formula",
      "plain",
      "ignored",
    ]);
    expect(result.current.csvJson).toEqual([
      { Column1: "", formula: "fallback", plain: "", ignored: 0 },
    ]);
  });

  it("alerts when XLSX has no first worksheet", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.mocked(readXlsxFile).mockResolvedValue([]);
    const { result } = renderHook(() => useCsvData());

    await act(async () => {
      await result.current.handleCsvUpload(
        fileEvent(new File([new Uint8Array([1])], "empty.xlsx")),
      );
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "No worksheet found in the Excel file",
    );
    expect(result.current.csvJson).toEqual([]);
    expect(result.current.csvColumns).toEqual([]);
  });

  it("alerts when XLSX loading fails", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("bad workbook");
    vi.mocked(readXlsxFile).mockRejectedValue(error);
    const { result } = renderHook(() => useCsvData());

    await act(async () => {
      await result.current.handleCsvUpload(
        fileEvent(new File([new Uint8Array([1])], "broken.xlsx")),
      );
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Error reading Excel file:",
      error,
    );
    expect(alertSpy).toHaveBeenCalledWith(
      "Error reading the Excel file. Please check the file format.",
    );
  });

  it("alerts on unsupported file extensions", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useCsvData());

    await act(async () => {
      await result.current.handleCsvUpload(
        fileEvent(new File(["x"], "data.txt")),
      );
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Not supported format. Upload a .csv or .xlsx file",
    );
    expect(Papa.parse).not.toHaveBeenCalled();
  });
});
