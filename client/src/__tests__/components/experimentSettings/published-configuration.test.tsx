import {
  existingExperiment,
  fetchMock,
  firestoreMocks,
  okJson,
  registerExperimentsettingsHooks,
  token,
} from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExperimentSettings from "../../../pages/ExperimentPanel/ExperimentSettings";

describe("ExperimentSettings", () => {
  registerExperimentsettingsHooks();

  it("loads settings and saves only batch, recruitment and captcha in one write", async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce(
      existingExperiment({
        batchConfig: {
          useIndexedDB: true,
          batchSize: 12,
          resumeTimeoutMinutes: 45,
        },
        recruitmentConfig: {
          platform: "none",
          prolificCompletionCode: "",
        },
        captchaConfig: {
          enabled: false,
          provider: "hcaptcha",
          siteKey: "",
        },
      }),
    );
    fetchMock()
      .mockResolvedValueOnce(
        okJson({
          tokens: [token({ id: "counter-token", type: "counter" })],
          separator: "_",
        }),
      )
      .mockResolvedValueOnce(okJson({ success: true }));

    render(<ExperimentSettings experimentID="exp-published" />);

    const indexedDb = await screen.findByLabelText(
      "Use IndexedDB (Client-side persistence)",
    );
    expect(indexedDb).toBeChecked();
    expect(screen.getByTestId("appearance-settings")).toHaveTextContent(
      "exp-published",
    );
    expect(screen.getByTestId("custom-domain-settings")).toHaveTextContent(
      "exp-published",
    );

    fireEvent.change(screen.getByLabelText("Batch Size"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Batch Size"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("Resume Timeout (minutes)"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Resume Timeout (minutes)"), {
      target: { value: "90" },
    });
    fireEvent.click(screen.getByText("Prolific"));
    fireEvent.change(await screen.findByLabelText("Prolific Completion Code"), {
      target: { value: "COMPLETE42" },
    });
    fireEvent.click(screen.getByLabelText("Enable CAPTCHA"));
    fireEvent.click(screen.getByRole("button", { name: "reCAPTCHA v2" }));
    fireEvent.change(screen.getByLabelText(/Site Key/), {
      target: { value: "recaptcha-site-key" },
    });
    fireEvent.click(screen.getByText("- hyphen"));
    fireEvent.click(screen.getAllByText("Save Configuration")[0]);

    await waitFor(() => {
      expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
        "experiments/exp-published",
        {
          batchConfig: {
            useIndexedDB: true,
            batchSize: 25,
            resumeTimeoutMinutes: 90,
          },
          recruitmentConfig: {
            platform: "prolific",
            prolificCompletionCode: "COMPLETE42",
          },
          captchaConfig: {
            enabled: true,
            provider: "recaptcha",
            siteKey: "recaptcha-site-key",
          },
        },
        { merge: true },
      );
    });

    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Configuration saved successfully!"),
    ).toBeInTheDocument();
  });

  it("does not save published settings if the experiment id is later cleared", async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce(existingExperiment({}));
    fetchMock().mockResolvedValueOnce(
      okJson({
        tokens: [token({ id: "counter-token", type: "counter" })],
        separator: "_",
      }),
    );

    const { rerender } = render(
      <ExperimentSettings experimentID="exp-will-clear" />,
    );

    await screen.findAllByText("Save Configuration");
    rerender(<ExperimentSettings experimentID={undefined} />);
    fireEvent.click(screen.getAllByText("Save Configuration")[0]);

    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });
});
