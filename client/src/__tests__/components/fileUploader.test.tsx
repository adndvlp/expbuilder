import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FileUploader from "../../pages/ExperimentBuilder/components/Timeline/FileUploader";

vi.mock("react-switch", () => ({
  default: ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
    <button
      type="button"
      aria-label="toggle switch"
      data-checked={String(checked)}
      onClick={() => onChange(!checked)}
    />
  ),
}));

const files = [
  { name: "first.png", url: "uploads/img/first.png", type: "img" },
  { name: "nested/second.png", url: "uploads/img/second.png", type: "img" },
  { name: ".DS_Store", url: "uploads/img/.DS_Store", type: "img" },
];

function installClipboard(writeText = vi.fn(async () => undefined)) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

function renderUploader(overrides: Partial<React.ComponentProps<typeof FileUploader>> = {}) {
  const props = {
    uploadedFiles: files,
    onFileUpload: vi.fn(),
    onDeleteFile: vi.fn(),
    onDeleteMultipleFiles: vi.fn(async () => undefined),
    fileInputRef: React.createRef<HTMLInputElement>(),
    folderInputRef: React.createRef<HTMLInputElement>(),
    accept: "image/*",
    ...overrides,
  };

  const view = render(<FileUploader {...props} />);
  return { props, ...view };
}

describe("FileUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installClipboard();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders upload inputs, filters .DS_Store and forwards upload changes", () => {
    const { props, container } = renderUploader();

    expect(screen.getByText("first.png")).toBeInTheDocument();
    expect(screen.getByText("second.png")).toBeInTheDocument();
    expect(screen.queryByText(".DS_Store")).not.toBeInTheDocument();

    const [fileInput, folderInput] = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="file"]'),
    );
    expect(fileInput).toHaveAttribute("accept", "image/*");
    expect(folderInput).toHaveAttribute("accept", "image/*");

    const upload = new File(["data"], "upload.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [upload] } });

    expect(props.onFileUpload).toHaveBeenCalledTimes(1);
  });

  it("copies file URLs and clears the copied label after a timeout", async () => {
    vi.useFakeTimers();
    const writeText = installClipboard();
    renderUploader();

    await act(async () => {
      fireEvent.click(screen.getByText("first.png"));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith("uploads/img/first.png");
    expect(screen.getByText("Copied to clipboard!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("first.png")).toBeInTheDocument();
  });

  it("deletes one file outside multi-select mode", () => {
    const { props } = renderUploader();

    fireEvent.click(screen.getAllByTitle("Delete file")[0]);

    expect(props.onDeleteFile).toHaveBeenCalledWith(files[0]);
  });

  it("deletes selected files through the bulk delete callback", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { props } = renderUploader();

    fireEvent.click(screen.getByText("Select multiple files"));

    const switches = screen.getAllByLabelText("toggle switch");
    fireEvent.click(switches[1]);

    expect(screen.getByText("Delete selected (1)")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("Delete selected (1)"));
      await Promise.resolve();
    });

    expect(window.confirm).toHaveBeenCalledWith("Delete 1 selected file(s)?");
    expect(props.onDeleteMultipleFiles).toHaveBeenCalledWith([files[0]]);
    expect(screen.getByText("Select multiple files")).toBeInTheDocument();
  });

  it("falls back to deleting selected files one by one without a bulk callback", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { props } = renderUploader({ onDeleteMultipleFiles: undefined });

    fireEvent.click(screen.getByText("Select multiple files"));

    const switches = screen.getAllByLabelText("toggle switch");
    fireEvent.click(switches[1]);
    fireEvent.click(switches[2]);
    fireEvent.click(screen.getByText("Delete selected (2)"));

    expect(props.onDeleteFile).toHaveBeenCalledWith(files[0]);
    expect(props.onDeleteFile).toHaveBeenCalledWith(files[1]);
  });
});
