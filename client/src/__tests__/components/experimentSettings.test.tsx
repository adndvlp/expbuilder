import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
      target: { value: "25" },
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
