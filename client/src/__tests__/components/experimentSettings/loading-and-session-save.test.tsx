import {
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

    expect(fetchMock()).not.toHaveBeenCalled();
    expect(firestoreMocks.getDoc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Save Session Name"));

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
    fireEvent.click(screen.getByText("Reload saved settings"));
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

    fireEvent.click(screen.getByText("Save Session Name"));

    expect(
      screen.getAllByText(/Debes incluir al menos/).length,
    ).toBeGreaterThan(0);
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("+ Random ID"));
    fireEvent.click(screen.getByText("Save Session Name"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledTimes(2);
    });

    const [url, options] = fetchMock().mock.calls[1];
    expect(url).toBe("http://localhost:3000/api/session-name-config/exp-123");
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.separator).toBe("-");
    expect(body.tokens.map((item: SessionToken) => item.type)).toEqual([
      "date",
      "randomAlpha",
    ]);
    expect(
      await screen.findByText("Session name configuration saved!"),
    ).toBeInTheDocument();
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });

  it("surfaces errors when saving only the session naming configuration fails", async () => {
    fetchMock()
      .mockResolvedValueOnce(
        okJson({
          tokens: [token({ id: "counter-token", type: "counter" })],
          separator: "_",
        }),
      )
      .mockResolvedValueOnce(failedResponse());

    render(<ExperimentSettings experimentID="exp-session-fail" />);

    await screen.findByText("Participant Number");
    fireEvent.click(screen.getByText("Save Session Name"));

    expect(
      await screen.findByText("Error saving session name configuration"),
    ).toBeInTheDocument();
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });
});
