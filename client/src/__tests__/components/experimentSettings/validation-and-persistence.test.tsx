import {
  existingExperiment,
  failedResponse,
  fetchMock,
  firestoreMocks,
  okJson,
  registerExperimentsettingsHooks,
  token,
} from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExperimentSettings from "../../../pages/ExperimentPanel/ExperimentSettings";

describe("ExperimentSettings", () => {
  registerExperimentsettingsHooks();

  it("renders IndexedDB-off storage and MTurk guidance while allowing IndexedDB to be re-enabled", async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce(
      existingExperiment({
        batchConfig: {
          useIndexedDB: false,
          batchSize: 0,
          resumeTimeoutMinutes: 30,
        },
        recruitmentConfig: {
          platform: "mturk",
          prolificCompletionCode: "",
        },
        captchaConfig: {
          enabled: false,
          provider: "hcaptcha",
          siteKey: "",
        },
      }),
    );
    fetchMock().mockResolvedValueOnce(okJson(null));

    render(<ExperimentSettings experimentID="exp-mturk" />);

    const indexedDb = await screen.findByLabelText(
      "Use IndexedDB (Client-side persistence)",
    );
    expect(indexedDb).not.toBeChecked();
    expect(
      screen.getByText(/Trials sent individually to Firestore/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/assignmentId=ASSIGNMENT_ID_NOT_AVAILABLE/),
    ).toBeInTheDocument();

    fireEvent.click(indexedDb);

    expect(indexedDb).toBeChecked();
    expect(screen.getByText(/Trials cached locally/)).toBeInTheDocument();
  });

  it("blocks combined save when session naming tokens are not unique", async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce(existingExperiment({}));
    fetchMock().mockResolvedValueOnce(
      okJson({
        tokens: [token({ id: "date-token", type: "date" })],
        separator: "_",
      }),
    );

    render(<ExperimentSettings experimentID="exp-published" />);

    await screen.findByText("Save Configuration");
    fireEvent.click(screen.getByText("Save Configuration"));

    expect(
      await screen.findByText("Session name configuration is invalid."),
    ).toBeInTheDocument();
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });

  it("surfaces errors from the session-name API during combined save", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    firestoreMocks.getDoc.mockResolvedValueOnce(existingExperiment({}));
    fetchMock()
      .mockResolvedValueOnce(
        okJson({
          tokens: [token({ id: "counter-token", type: "counter" })],
          separator: "_",
        }),
      )
      .mockResolvedValueOnce(failedResponse());

    render(<ExperimentSettings experimentID="exp-published" />);

    await screen.findByText("Save Configuration");
    fireEvent.click(screen.getByText("Save Configuration"));

    expect(
      await screen.findByText("Error saving configuration"),
    ).toBeInTheDocument();
    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1);
  });
});
