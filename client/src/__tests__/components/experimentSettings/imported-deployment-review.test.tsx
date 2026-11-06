import {
  localSettings,
  localSettingsFetch,
  okJson,
  registerExperimentsettingsHooks,
} from "./testHarness";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExperimentSettings from "../../../pages/ExperimentPanel/ExperimentSettings";
import { requireFunctionalSettings } from "../../../lib/functionalSettings";

describe("Imported deployment settings", () => {
  registerExperimentsettingsHooks();
  const imported = () => ({
    ...localSettings(),
    settingsMigration: { state: "complete", source: "package" },
    deploymentReview: {
      required: true,
      reasons: ["Verify the CAPTCHA site key and custom backend URLs."],
    },
  });
  it("requires an explicit review even when imported functional settings are complete", async () => {
    localSettingsFetch.mockResolvedValue(okJson(imported()));
    render(<ExperimentSettings experimentID="copy" />);
    const confirm = await screen.findByRole("button", {
      name: "Confirm and Save Configuration",
    });
    expect(screen.getByText(/Verify the CAPTCHA/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Recover Published Settings" }),
    ).not.toBeInTheDocument();
    localSettingsFetch.mockResolvedValueOnce(
      okJson({
        ...imported(),
        deploymentReview: { required: false, reasons: [] },
      }),
    );
    await act(async () => fireEvent.click(confirm));
    expect(localSettingsFetch).toHaveBeenLastCalledWith(
      expect.stringContaining("/copy"),
      expect.objectContaining({
        body: expect.stringContaining('"confirmDeploymentReview":true'),
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save Configuration" }),
      ).toBeDisabled(),
    );
  });
  it("blocks public code generation until the review is confirmed", async () => {
    localSettingsFetch.mockResolvedValue(okJson(imported()));
    await expect(requireFunctionalSettings("copy")).rejects.toThrow(/review/i);
  });
});
