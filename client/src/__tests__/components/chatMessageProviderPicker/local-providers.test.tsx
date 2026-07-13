import {
  anthropic,
  mocks,
  ollama,
  openai,
  registerProviderpickerHooks,
} from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderView } from "../../../components/Chat/ProviderPicker";

describe("ProviderPicker", () => {
  registerProviderpickerHooks();

  it("loads local provider models and selects one without requiring an API key", async () => {
    const onClose = vi.fn();
    const localModel = {
      id: "llama3.1",
      name: "Llama 3.1",
      shortName: "Llama 3.1",
      contextK: 128,
      tier: "balanced",
      description: "",
    };
    const secondLocalModel = {
      id: "mistral-local",
      name: "Mistral Local",
      shortName: "Mistral Local",
      contextK: 128,
      tier: "balanced",
      description: "",
    };

    mocks.chatState = {
      ...mocks.chatState,
      provider: ollama,
      model: localModel,
      apiKeys: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: vi.fn(async () => ({
          models: [
            { id: "llama3.1", name: "Llama 3.1" },
            { id: "mistral-local", name: "Mistral Local" },
          ],
        })),
      })),
    );

    render(<ProviderView onClose={onClose} />);

    expect(await screen.findByText("Llama 3.1")).toBeInTheDocument();
    expect(screen.getByText("Mistral Local")).toBeInTheDocument();
    expect(screen.getByText("2 models")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Mistral Local"));

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/providers/ollama/models",
    );
    expect(mocks.setProviderAndModel).toHaveBeenCalledWith(
      "ollama",
      secondLocalModel.id,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders provider loading, connected non-active providers and one-model labels", () => {
    mocks.providersState = { providers: [], loading: true };
    const { unmount } = render(<ProviderView onClose={vi.fn()} />);

    expect(screen.getByText("Loading providers…")).toBeInTheDocument();
    unmount();

    const oneModelProvider = {
      ...openai,
      id: "single-provider",
      name: "Single Provider",
      keyPlaceholder: undefined,
      models: [
        {
          ...openai.models[0],
          id: "single-model",
          name: "Only Model",
          shortName: "Only",
        },
      ],
    };
    mocks.chatState = {
      ...mocks.chatState,
      provider: oneModelProvider,
      model: oneModelProvider.models[0],
      apiKeys: { "single-provider": "single-key", anthropic: "ant-key" },
    };
    mocks.providersState = {
      providers: [oneModelProvider, anthropic],
      loading: false,
    };
    render(<ProviderView onClose={vi.fn()} />);

    expect(screen.getByPlaceholderText("API key…")).toBeInTheDocument();
    expect(screen.getAllByText("1 model").length).toBeGreaterThan(0);
    expect(document.querySelector(".pv-dot.teal")).toBeInTheDocument();
  });

  it("renders local provider error and empty-model states", async () => {
    mocks.chatState = {
      ...mocks.chatState,
      provider: ollama,
      model: { id: "none", name: "None", shortName: "None" },
      apiKeys: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: vi.fn(async () => ({ error: "Ollama offline" })),
      })),
    );

    const { unmount } = render(<ProviderView onClose={vi.fn()} />);

    expect(
      await screen.findByText("Could not connect to Ollama."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ollama offline").length).toBeGreaterThan(0);
    unmount();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: vi.fn(async () => ({})),
      })),
    );
    render(<ProviderView onClose={vi.fn()} />);

    expect(
      await screen.findByText("No models found in Ollama."),
    ).toBeInTheDocument();
  });

  it("falls back to local model ids when names are missing", async () => {
    mocks.chatState = {
      ...mocks.chatState,
      provider: ollama,
      model: { id: "other", name: "Other", shortName: "Other" },
      apiKeys: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: vi.fn(async () => ({ models: [{ id: "bare-model" }] })),
      })),
    );

    render(<ProviderView onClose={vi.fn()} />);

    expect(await screen.findByText("bare-model")).toBeInTheDocument();
    expect(screen.getAllByText("1 model").length).toBeGreaterThan(0);
  });
});
