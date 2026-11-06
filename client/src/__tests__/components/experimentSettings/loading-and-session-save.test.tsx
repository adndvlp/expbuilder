import {
  localSettings,
  localSettingsFetch,
  failedResponse,
  fetchMock,
  firestoreMocks,
  okJson,
  registerExperimentsettingsHooks,
  token,
  type SessionToken,
} from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExperimentSettings from "../../../pages/ExperimentPanel/ExperimentSettings";

describe("ExperimentSettings", () => {
  registerExperimentsettingsHooks();

  it("skips remote loading and session saves when no experiment id is provided", () => {
    render(<ExperimentSettings experimentID={undefined} />);

    expect(
      screen.getByRole("button", { name: "Save Configuration" }),
    ).toBeDisabled();
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(firestoreMocks.getDoc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save Configuration" }));

    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("shows local read failures and allows retrying without Firestore", async () => {
    localSettingsFetch.mockRejectedValueOnce(
      new Error("Local API unavailable"),
    );
    render(<ExperimentSettings experimentID="exp-load-error" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Local API unavailable",
    );
    fireEvent.click(screen.getByText("Retry"));
    expect(
      await screen.findByLabelText("Use IndexedDB (Client-side persistence)"),
    ).toBeInTheDocument();
    expect(firestoreMocks.getDoc).not.toHaveBeenCalled();
  });

  it("handles empty and non-ok session config responses", async () => {
    fetchMock().mockResolvedValueOnce(okJson({}));

    const { rerender } = render(
      <ExperimentSettings experimentID="exp-empty" />,
    );

    expect(
      await screen.findByText("add components to see a preview"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Add components above to build the session name"),
    ).toBeInTheDocument();

    fetchMock().mockResolvedValueOnce(failedResponse());
    rerender(<ExperimentSettings experimentID="exp-no-session-config" />);

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledTimes(2);
    });
    expect(
      screen.getByText("add components to see a preview"),
    ).toBeInTheDocument();
  });

  it("loads session naming for unpublished experiments and validates uniqueness before saving it", async () => {
    fetchMock()
      .mockResolvedValueOnce(
        okJson({
          tokens: [token({ id: "date-token", type: "date" })],
          separator: "-",
        }),
      )
      .mockResolvedValueOnce(okJson({ success: true }));

    render(<ExperimentSettings experimentID="exp-123" />);

    expect(
      await screen.findByLabelText("Use IndexedDB (Client-side persistence)"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Date")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Batch Size"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Configuration" }));

    expect(
      screen.getAllByText(/Debes incluir al menos/).length,
    ).toBeGreaterThan(0);
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("+ Random ID"));
    fireEvent.click(screen.getByRole("button", { name: "Save Configuration" }));

    await waitFor(() => {
      expect(localSettingsFetch).toHaveBeenCalledTimes(2);
    });

    const [url, options] = localSettingsFetch.mock.calls[1];
    expect(url).toBe("http://localhost:3000/api/functional-settings/exp-123");
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.sessionNameConfig.separator).toBe("-");
    expect(
      body.sessionNameConfig.tokens.map((item: SessionToken) => item.type),
    ).toEqual(["date", "randomAlpha"]);
    expect(
      await screen.findByText("Configuration saved on this device."),
    ).toBeInTheDocument();
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });

  it("surfaces errors when the unified configuration save fails", async () => {
    fetchMock().mockResolvedValueOnce(
      okJson({
        tokens: [token({ id: "counter-token", type: "counter" })],
        separator: "_",
      }),
    );
    localSettingsFetch
      .mockResolvedValueOnce(okJson(localSettings()))
      .mockResolvedValueOnce(failedResponse());

    render(<ExperimentSettings experimentID="exp-session-fail" />);

    await screen.findByText("Participant Number");
    fireEvent.change(screen.getByLabelText("Batch Size"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Configuration" }));

    expect(
      await screen.findByText(/Could not access the saved configuration/),
    ).toBeInTheDocument();
    expect(localSettingsFetch).toHaveBeenCalledTimes(2);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });
});
