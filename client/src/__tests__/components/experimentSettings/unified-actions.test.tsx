import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  localSettings,
  localSettingsFetch,
  fetchMock,
  okJson,
  registerExperimentsettingsHooks,
} from "./testHarness";
import ExperimentSettings from "../../../pages/ExperimentPanel/ExperimentSettings";

const saveButton = () =>
  screen.getByRole("button", { name: "Save Configuration" });
const batchInput = () => screen.getByLabelText("Batch Size");
const changeBatch = (value: number) =>
  fireEvent.change(batchInput(), { target: { value: String(value) } });
const ready = async () => {
  await screen.findByLabelText("Batch Size");
};

describe("Unified configuration actions", () => {
  registerExperimentsettingsHooks();

  it("has one save action, enabled only for changed values, and saves session naming with the settings", async () => {
    render(<ExperimentSettings experimentID="local" />);
    await ready();
    expect(
      screen.getAllByRole("button", { name: "Save Configuration" }),
    ).toHaveLength(1);
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByText("Save Session Name")).not.toBeInTheDocument();
    expect(screen.queryByText("Reload saved settings")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Recover/ }),
    ).not.toBeInTheDocument();
    changeBatch(22);
    fireEvent.click(screen.getByText("+ Random ID"));
    expect(saveButton()).toBeEnabled();
    localSettingsFetch.mockResolvedValueOnce(
      okJson({
        ...localSettings(),
        revision: 2,
        functionalSettings: {
          ...localSettings().functionalSettings,
          revision: 2,
        },
      }),
    );
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveButton()).toBeDisabled());
    const [, init] = localSettingsFetch.mock.calls[1];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toMatchObject({
      expectedRevision: 1,
      settings: { batchConfig: { batchSize: 22 } },
      sessionNameConfig: {
        tokens: [expect.objectContaining({ type: "randomAlpha" })],
      },
    });
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Configuration saved on this device."),
    ).toBeInTheDocument();
  });

  it("requires an explicit confirmation save for incomplete legacy values, even without edits", async () => {
    localSettingsFetch.mockResolvedValueOnce(
      okJson({
        functionalSettings: null,
        revision: 0,
        settingsMigration: { state: "needs_remote_read", source: "local" },
      }),
    );
    render(<ExperimentSettings experimentID="legacy" />);
    const confirm = await screen.findByRole("button", {
      name: "Confirm and Save Configuration",
    });
    expect(confirm).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Recover Published Settings" }),
    ).toBeInTheDocument();
    localSettingsFetch.mockResolvedValueOnce(okJson(localSettings()));
    fireEvent.click(confirm);
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(
      screen.queryByRole("button", { name: /Recover/ }),
    ).not.toBeInTheDocument();
  });

  it("only discards edits after confirmation and reloads saved values", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ExperimentSettings experimentID="local" />);
    await ready();
    expect(
      screen.queryByRole("button", { name: "Discard Changes" }),
    ).not.toBeInTheDocument();
    changeBatch(22);
    fireEvent.click(screen.getByRole("button", { name: "Discard Changes" }));
    expect(confirm).toHaveBeenCalledWith(
      expect.stringMatching(/unsaved changes/i),
    );
    expect(batchInput()).toHaveValue(22);
    expect(localSettingsFetch).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Discard Changes" }));
    await waitFor(() => expect(batchInput()).toHaveValue(0));
    expect(localSettingsFetch).toHaveBeenCalledTimes(2);
    expect(saveButton()).toBeDisabled();
  });

  it("keeps changes on a revision conflict and loads the newer version only after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ExperimentSettings experimentID="local" />);
    await ready();
    changeBatch(22);
    localSettingsFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        code: "SETTINGS_REVISION_CONFLICT",
        message: "Settings changed.",
      }),
    });
    fireEvent.click(saveButton());
    const load = await screen.findByRole("button", {
      name: "Load Saved Version",
    });
    expect(batchInput()).toHaveValue(22);
    expect(saveButton()).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Discard Changes" }),
    ).not.toBeInTheDocument();
    fireEvent.click(load);
    expect(batchInput()).toHaveValue(22);
    expect(localSettingsFetch).toHaveBeenCalledTimes(2);
    localSettingsFetch.mockResolvedValueOnce(
      okJson({
        ...localSettings(),
        revision: 2,
        functionalSettings: {
          ...localSettings().functionalSettings,
          revision: 2,
          batchConfig: {
            useIndexedDB: true,
            batchSize: 77,
            resumeTimeoutMinutes: 30,
          },
        },
      }),
    );
    confirm.mockReturnValue(true);
    fireEvent.click(load);
    await waitFor(() => expect(batchInput()).toHaveValue(77));
    expect(
      screen.queryByRole("button", { name: "Load Saved Version" }),
    ).not.toBeInTheDocument();
    changeBatch(99);
    fireEvent.click(saveButton());
    await waitFor(() => expect(localSettingsFetch).toHaveBeenCalledTimes(4));
    expect(
      JSON.parse(localSettingsFetch.mock.calls[3][1].body).expectedRevision,
    ).toBe(2);
  });

  it("offers Retry on a failed load and blocks saving until all local settings load", async () => {
    fetchMock().mockRejectedValueOnce(new Error("Session names unavailable"));
    render(<ExperimentSettings experimentID="local" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session names unavailable",
    );
    expect(saveButton()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await ready();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });
});
