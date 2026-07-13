import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExperimentSettings from "../../pages/ExperimentPanel/ExperimentSettings";

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn((...segments: unknown[]) => segments.slice(1).join("/")),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: firestoreMocks.doc,
  getDoc: firestoreMocks.getDoc,
  setDoc: firestoreMocks.setDoc,
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock("../../pages/ExperimentPanel/AppearanceSettings", () => ({
  default: ({ experimentID }: { experimentID?: string }) => (
    <div data-testid="appearance-settings">Appearance {experimentID}</div>
  ),
}));

vi.mock("../../pages/ExperimentPanel/CustomDomainSettings", () => ({
  default: ({ experimentID }: { experimentID?: string }) => (
    <div data-testid="custom-domain-settings">Domain {experimentID}</div>
  ),
}));

type SessionToken = {
  id: string;
  type: "date" | "time" | "randomAlpha" | "customText" | "counter";
  dateFormat: string;
  timeFormat: string;
  randomLength: number;
  customValue: string;
  counterDigits: number;
};

function token(overrides: Partial<SessionToken>): SessionToken {
  return {
    id: "token-1",
    type: "counter",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH-mm-ss",
    randomLength: 6,
    customValue: "",
    counterDigits: 3,
    ...overrides,
  };
}

function okJson(payload: unknown): Response {
  return {
    ok: true,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function failedResponse(): Response {
  return {
    ok: false,
    json: vi.fn(async () => ({})),
  } as unknown as Response;
}

function existingExperiment(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  };
}

function missingExperiment() {
  return {
    exists: () => false,
    data: () => ({}),
  };
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

describe("ExperimentSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    firestoreMocks.doc.mockImplementation((...segments: unknown[]) =>
      segments.slice(1).join("/"),
    );
    firestoreMocks.getDoc.mockResolvedValue(missingExperiment());
    firestoreMocks.setDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("skips remote loading and session saves when no experiment id is provided", () => {
    render(<ExperimentSettings experimentID={undefined} />);

    expect(fetchMock()).not.toHaveBeenCalled();
    expect(firestoreMocks.getDoc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Save Session Name"));

    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("logs Firebase load failures without blocking local settings", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    firestoreMocks.getDoc.mockRejectedValueOnce(new Error("firebase down"));
    fetchMock().mockRejectedValueOnce(new Error("session api down"));

    render(<ExperimentSettings experimentID="exp-load-error" />);

    expect(
      await screen.findByText("Session Name Configuration"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error loading Firebase configuration:",
        expect.any(Error),
      );
    });
  });

  it("handles empty and non-ok session config responses", async () => {
    fetchMock().mockResolvedValueOnce(okJson({}));

    const { rerender } = render(<ExperimentSettings experimentID="exp-empty" />);

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
      await screen.findByText(
        /Data configuration options are available after the experiment is published/,
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Date")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Save Session Name"));

    expect(screen.getAllByText(/Debes incluir al menos/).length).toBeGreaterThan(
      0,
    );
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("+ Random ID"));
    fireEvent.click(screen.getByText("Save Session Name"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledTimes(2);
    });

    const [url, options] = fetchMock().mock.calls[1];
    expect(url).toBe(
      "http://localhost:3000/api/session-name-config/exp-123",
    );
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

  it("loads published experiment settings and saves batch, recruitment, captcha, and session naming config", async () => {
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
    fireEvent.click(screen.getByText("Save Configuration"));

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

    const [url, options] = fetchMock().mock.calls[1];
    expect(url).toBe(
      "http://localhost:3000/api/session-name-config/exp-published",
    );
    expect(JSON.parse((options as RequestInit).body as string)).toMatchObject({
      separator: "-",
      tokens: [expect.objectContaining({ type: "counter" })],
    });
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

    await screen.findByText("Save Configuration");
    rerender(<ExperimentSettings experimentID={undefined} />);
    fireEvent.click(screen.getByText("Save Configuration"));

    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

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
    expect(screen.getByText("Límite de 6 componentes alcanzado")).toBeInTheDocument();
  });

  it("falls back to relative API URLs when the API env var is absent", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_URL", undefined);
    fetchMock().mockResolvedValueOnce(okJson({}));

    const { default: IsolatedExperimentSettings } = await import(
      "../../pages/ExperimentPanel/ExperimentSettings"
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
