import {
  localSettings,
  localSettingsFetch,
  fetchMock,
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExperimentSettings from "../../../pages/ExperimentPanel/ExperimentSettings";
import { auth } from "../../../lib/firebase";

const pending = (source = "local") => ({
  functionalSettings: null,
  revision: 0,
  settingsMigration: { state: "needs_remote_read", source },
});
const recovered = () => ({
  ...localSettings({
    batchConfig: {
      useIndexedDB: true,
      batchSize: 48,
      resumeTimeoutMinutes: 30,
    },
  }),
  revision: 5,
});

describe("Contextual settings recovery", () => {
  registerExperimentsettingsHooks();
  beforeEach(() => {
    (auth as any).currentUser = {
      uid: "owner",
      getIdToken: vi.fn(async () => "owner-token"),
    };
  });
  afterEach(() => {
    (auth as any).currentUser = null;
  });

  it("confirms replacing functional edits, recovers only on request and retains unsaved session names", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    localSettingsFetch.mockResolvedValueOnce(okJson(pending()));
    render(<ExperimentSettings experimentID="legacy" />);
    const recover = await screen.findByRole("button", {
      name: "Recover Published Settings",
    });
    expect(localSettingsFetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Batch Size"), {
      target: { value: "99" },
    });
    fireEvent.click(screen.getByText("+ Random ID"));
    fireEvent.click(recover);
    expect(localSettingsFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Batch Size")).toHaveValue(99);
    confirm.mockReturnValue(true);
    localSettingsFetch.mockResolvedValueOnce(okJson(recovered()));
    fireEvent.click(recover);
    await waitFor(() =>
      expect(screen.getByLabelText("Batch Size")).toHaveValue(48),
    );
    expect(localSettingsFetch.mock.calls[1][1]).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer owner-token" },
    });
    expect(screen.getByText("Random ID")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save Configuration" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(localSettingsFetch).toHaveBeenCalledTimes(3));
    expect(JSON.parse(localSettingsFetch.mock.calls[2][1].body)).toMatchObject({
      expectedRevision: 5,
      sessionNameConfig: {
        tokens: [expect.objectContaining({ type: "randomAlpha" })],
      },
    });
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it("lets a package with unknown settings be reviewed locally without offering origin recovery", async () => {
    localSettingsFetch.mockResolvedValueOnce(okJson(pending("package")));
    render(<ExperimentSettings experimentID="copy" />);
    expect(
      await screen.findByRole("button", {
        name: "Confirm and Save Configuration",
      }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /Recover/ }),
    ).not.toBeInTheDocument();
    expect(localSettingsFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps manual review available after an authentication error", async () => {
    (auth as any).currentUser = null;
    localSettingsFetch.mockResolvedValueOnce(okJson(pending()));
    render(<ExperimentSettings experimentID="legacy" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Recover Published Settings" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign in with the owner account",
    );
    expect(
      screen.getByRole("button", { name: "Confirm and Save Configuration" }),
    ).toBeEnabled();
    expect(localSettingsFetch).toHaveBeenCalledTimes(1);
  });

  it("ignores a recovery response belonging to the previous experiment after navigation", async () => {
    let resolveRecovery!: (response: Response) => void;
    localSettingsFetch.mockResolvedValueOnce(okJson(pending()));
    const { rerender } = render(<ExperimentSettings experimentID="legacy" />);
    const button = await screen.findByRole("button", {
      name: "Recover Published Settings",
    });
    localSettingsFetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveRecovery = resolve;
        }),
    );
    fireEvent.click(button);
    await waitFor(() => expect(localSettingsFetch).toHaveBeenCalledTimes(2));
    localSettingsFetch.mockResolvedValueOnce(okJson(localSettings()));
    rerender(<ExperimentSettings experimentID="another" />);
    await waitFor(() =>
      expect(screen.getByLabelText("Batch Size")).toHaveValue(0),
    );
    await act(async () => resolveRecovery(okJson(recovered())));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save Configuration" }),
      ).toBeDisabled(),
    );
    expect(screen.getByLabelText("Batch Size")).toHaveValue(0);
  });
});
