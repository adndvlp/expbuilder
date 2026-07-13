import {
  fetchMock,
  okJson,
  registerExperimentsettingsHooks,
  token,
} from "./testHarness";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExperimentSettings from "../../../pages/ExperimentPanel/ExperimentSettings";

describe("ExperimentSettings", () => {
  registerExperimentsettingsHooks();

  it("edits, drags, and removes session naming tokens", async () => {
    fetchMock().mockResolvedValueOnce(
      okJson({
        tokens: [
          token({
            id: "date-token",
            type: "date",
            dateFormat: "YYYY-MM-DD",
          }),
          token({
            id: "time-token",
            type: "time",
            timeFormat: "HH-mm-ss",
          }),
          token({
            id: "random-token",
            type: "randomAlpha",
            randomLength: 6,
          }),
          token({
            id: "custom-token",
            type: "customText",
            customValue: "",
          }),
          token({
            id: "counter-token",
            type: "counter",
            counterDigits: 3,
          }),
        ],
        separator: "_",
      }),
    );

    const { container } = render(
      <ExperimentSettings experimentID="exp-token-editor" />,
    );

    const dateChip = await screen.findByText("Date");
    fireEvent.click(dateChip);
    fireEvent.click(within(dateChip.closest("div")!).getByTitle("Options"));
    expect(screen.queryByText("Date options")).not.toBeInTheDocument();
    fireEvent.click(within(dateChip.closest("div")!).getByTitle("Options"));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "DD-MM-YYYY" },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "MM-DD-YYYY" },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "YYYYMMDD" },
    });
    fireEvent.click(screen.getByText("Date"));
    expect(screen.queryByText("Date options")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Date"));

    fireEvent.click(screen.getByText("Time"));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "HH-mm" },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "HHmmss" },
    });

    fireEvent.click(screen.getByText("Random ID"));
    fireEvent.change(container.querySelector('input[type="range"]')!, {
      target: { value: "10" },
    });
    expect(screen.getByText("10 chars")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Custom Text"));
    fireEvent.change(screen.getByPlaceholderText(/pilot/), {
      target: { value: "pilot" },
    });
    expect(screen.getByText(/pilot/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Participant Number"));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByText("none"));
    expect(screen.getAllByText("·").length).toBeGreaterThan(0);

    const updatedDateChip = screen.getByText("Date").closest("div")!;
    const timeChip = screen.getByText("Time").closest("div")!;
    fireEvent.drop(timeChip);
    fireEvent.dragStart(updatedDateChip, {
      dataTransfer: { effectAllowed: "" },
    });
    fireEvent.dragEnter(timeChip);
    fireEvent.dragOver(timeChip);
    fireEvent.drop(timeChip);
    fireEvent.dragEnd(updatedDateChip);

    const currentTimeChip = screen.getByText("Time").closest("div")!;
    fireEvent.dragStart(currentTimeChip, {
      dataTransfer: { effectAllowed: "" },
    });
    fireEvent.drop(currentTimeChip);

    fireEvent.click(
      within(screen.getByText("Time").closest("div")!).getByTitle("Remove"),
    );
    expect(screen.queryByText("Time")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Date"));
    fireEvent.click(
      within(screen.getByText("Date").closest("div")!).getByTitle("Remove"),
    );

    expect(screen.queryByText("Date options")).not.toBeInTheDocument();
    expect(screen.queryByText("Date")).not.toBeInTheDocument();
  });

  it("shows max token state and keeps add actions bounded", async () => {
    fetchMock().mockResolvedValueOnce(
      okJson({
        tokens: [
          token({ id: "date-token", type: "date" }),
          token({ id: "time-token", type: "time" }),
          token({ id: "random-token", type: "randomAlpha" }),
          token({ id: "custom-token", type: "customText" }),
          token({ id: "counter-token", type: "counter" }),
          token({ id: "extra-token", type: "randomAlpha", randomLength: 4 }),
        ],
        separator: "_",
      }),
    );

    render(<ExperimentSettings experimentID="exp-max-tokens" />);

    expect(
      await screen.findByText("Límite de 6 componentes alcanzado"),
    ).toBeInTheDocument();
    const addDate = screen.getByText("+ Date");
    expect(addDate).toBeDisabled();

    addDate.removeAttribute("disabled");
    (addDate as HTMLButtonElement).disabled = false;
    fireEvent.click(addDate);
    expect(
      screen.getByText("Límite de 6 componentes alcanzado"),
    ).toBeInTheDocument();
  });

  it("falls back to relative API URLs when the API env var is absent", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_URL", undefined);
    fetchMock().mockResolvedValueOnce(okJson({}));

    const { default: IsolatedExperimentSettings } = await import(
      "../../../pages/ExperimentPanel/ExperimentSettings"
    );
    render(<IsolatedExperimentSettings experimentID="exp-relative-api" />);

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "/api/session-name-config/exp-relative-api",
      );
    });
  });

  it("hides stale token options if loaded tokens change underneath it", async () => {
    fetchMock()
      .mockResolvedValueOnce(
        okJson({
          tokens: [token({ id: "date-token", type: "date" })],
          separator: "_",
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          tokens: [token({ id: "counter-token", type: "counter" })],
          separator: "_",
        }),
      );

    const { rerender } = render(
      <ExperimentSettings experimentID="exp-stale-token" />,
    );

    fireEvent.click(await screen.findByText("Date"));
    expect(screen.getByText("Date options")).toBeInTheDocument();

    rerender(<ExperimentSettings experimentID="exp-stale-token-next" />);

    await waitFor(() => {
      expect(screen.queryByText("Date options")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Participant Number")).toBeInTheDocument();
  });
});
