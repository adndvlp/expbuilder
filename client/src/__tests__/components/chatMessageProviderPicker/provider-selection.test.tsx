import {
  mocks,
  registerChatProviderLookupHooks,
  registerProviderpickerHooks,
} from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ProviderBadge,
  ProviderView,
} from "../../../components/Chat/ProviderPicker";
import {
  DEFAULT_PROVIDER,
  findModel,
  findProvider,
} from "../../../components/Chat/providers";

describe("chat provider lookup", () => {
  registerChatProviderLookupHooks();

  it("falls back to the default provider and its first model", () => {
    expect(findProvider("missing-provider")).toBe(DEFAULT_PROVIDER);
    expect(findModel(DEFAULT_PROVIDER, "missing-model")).toBe(
      DEFAULT_PROVIDER.models[0],
    );
  });
});

describe("ProviderPicker", () => {
  registerProviderpickerHooks();

  it("renders the active provider badge and opens the picker", () => {
    const onOpen = vi.fn();

    render(<ProviderBadge onOpen={onOpen} />);

    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("filters available models and selects a model for the active provider", () => {
    const onClose = vi.fn();

    render(<ProviderView onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText("Search provider or model…"), {
      target: { value: "mini" },
    });
    fireEvent.click(screen.getByText("GPT-4o mini"));

    expect(mocks.setProviderAndModel).toHaveBeenCalledWith(
      "openai",
      "gpt-4o-mini",
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("selects another provider and saves a trimmed API key", () => {
    render(<ProviderView onClose={vi.fn()} />);

    const search = screen.getByPlaceholderText("Search provider or model…");
    fireEvent.change(search, { target: { value: "claude" } });
    fireEvent.click(screen.getByText("×"));
    expect(search).toHaveValue("");

    fireEvent.click(screen.getByText("Anthropic"));

    expect(screen.getByText("No API key")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Set your API key to see available models for Anthropic.",
      ),
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText("sk-ant-api03-…");
    fireEvent.change(input, { target: { value: "  sk-ant-new  " } });
    fireEvent.click(document.querySelector(".pv-key-btn")!);
    expect(input).toHaveAttribute("type", "text");
    fireEvent.blur(input);
    expect(mocks.setApiKey).toHaveBeenCalledWith("anthropic", "sk-ant-new");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(document.querySelector(".pv-key-btn.save")!);

    expect(mocks.setApiKey).toHaveBeenCalledWith("anthropic", "sk-ant-new");
  });
});
