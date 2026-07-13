import { registerDocsPageHooks } from "./testHarness";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import mermaid from "mermaid";
import Docs, { resetDocsMermaidForTests } from "../../../pages/Docs";

describe("Docs page", () => {
  registerDocsPageHooks();

  it("does not update mermaid output after unmounting during render", async () => {
    let resolveRender!: (value: { svg: string }) => void;
    const renderPromise = new Promise<{ svg: string }>((resolve) => {
      resolveRender = resolve;
    });
    vi.mocked(mermaid.render).mockReturnValueOnce(renderPromise);

    const { unmount } = render(<Docs />);
    await waitFor(() => {
      expect(mermaid.render).toHaveBeenCalled();
    });
    unmount();

    await act(async () => {
      resolveRender({ svg: '<svg data-late="true"></svg>' });
      await renderPromise;
    });

    expect(document.querySelector("[data-late='true']")).toBeNull();
  });

  it("does not update mermaid error state after unmounting during render failure", async () => {
    let rejectRender!: (reason?: unknown) => void;
    const renderPromise = new Promise<{ svg: string }>((_, reject) => {
      rejectRender = reject;
    });
    vi.mocked(mermaid.render).mockReturnValueOnce(renderPromise);

    const { unmount } = render(<Docs />);
    await waitFor(() => {
      expect(mermaid.render).toHaveBeenCalled();
    });
    unmount();

    await act(async () => {
      rejectRender(new Error("late render failure"));
      await renderPromise.catch(() => undefined);
    });

    expect(document.querySelector(".docs-mermaid-error")).toBeNull();
  });

  it("does not update mermaid error state after unmounting during loader failure", async () => {
    let rejectLoader!: (reason?: unknown) => void;
    const loaderPromise = new Promise<any>((_, reject) => {
      rejectLoader = reject;
    });
    resetDocsMermaidForTests(() => loaderPromise);

    const { unmount } = render(<Docs />);
    unmount();

    await act(async () => {
      rejectLoader(new Error("late loader failure"));
      await loaderPromise.catch(() => undefined);
    });

    expect(document.querySelector(".docs-mermaid-error")).toBeNull();
  });

  it("removes short-lived mermaid artifacts on cleanup", () => {
    const processed = document.createElement("div");
    processed.id = "mermaid-old";
    processed.setAttribute("data-processed", "true");
    const processedLong = document.createElement("div");
    processedLong.id = `mermaid-${"x".repeat(20)}`;
    processedLong.setAttribute("data-processed", "true");
    const dynamic = document.createElement("div");
    dynamic.id = "dmermaid-old";
    const dynamicLong = document.createElement("div");
    dynamicLong.id = `dmermaid-${"x".repeat(20)}`;
    document.body.append(processed, processedLong, dynamic, dynamicLong);

    const { unmount } = render(<Docs />);
    unmount();

    expect(processed.isConnected).toBe(false);
    expect(dynamic.isConnected).toBe(false);
    expect(processedLong.isConnected).toBe(true);
    expect(dynamicLong.isConnected).toBe(true);

    processedLong.remove();
    dynamicLong.remove();
  });
});
