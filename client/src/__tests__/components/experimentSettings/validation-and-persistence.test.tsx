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
    expect(screen.queryByLabelText('Batch Size')).not.toBeInTheDocument();
    expect(screen.getByText(/The same resume deadline applies to every storage provider/)).toBeInTheDocument();
    expect(screen.queryByText(/Partial save on disconnect/)).not.toBeInTheDocument();
    expect(screen.getByText(/Trials sent individually to Firestore/)).toBeInTheDocument();
    expect(
      screen.getByText(/assignmentId=ASSIGNMENT_ID_NOT_AVAILABLE/),
    ).toBeInTheDocument();

    fireEvent.click(indexedDb);

    expect(indexedDb).toBeChecked();
    expect(screen.getByText(/Trials cached locally/)).toBeInTheDocument();
    expect(screen.getByText(/the timeout cannot save responses that have never reached the server/)).toBeInTheDocument();
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

    await screen.findAllByText("Save Configuration");
    fireEvent.click(screen.getAllByText("Save Configuration")[0]);

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

    await screen.findAllByText("Save Configuration");
    fireEvent.click(screen.getAllByText("Save Configuration")[0]);

    expect(
      await screen.findByText("Error saving configuration"),
    ).toBeInTheDocument();
    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1);
  });
  it.each(['0', '1.5', '1441'])('rejects an invalid resume timeout %s before saving', async value => {
    firestoreMocks.getDoc.mockResolvedValueOnce(existingExperiment({}));
    fetchMock().mockResolvedValueOnce(okJson({ tokens: [token({ id: 'counter-token', type: 'counter' })], separator: '_' }));
    render(<ExperimentSettings experimentID="invalid-timeout" />);
    const input = await screen.findByLabelText('Resume Timeout (minutes)');
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getAllByText('Save Configuration')[0]);
    expect(await screen.findByText(/Resume Timeout must be an integer from 1 to 1440/)).toBeInTheDocument();
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });

});
