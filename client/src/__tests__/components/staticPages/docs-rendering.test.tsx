import { registerDocsPageHooks } from "./testHarness";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import mermaid from "mermaid";
import Docs, { resetDocsMermaidForTests } from "../../../pages/Docs";

describe("Docs page", () => {
  registerDocsPageHooks();

  it("renders markdown code variants, tables and mermaid diagrams", async () => {
    render(<Docs />);

    expect(screen.getByTestId("syntax-js")).toHaveTextContent(
      "const value = 1;",
    );
    expect(screen.getByTestId("syntax-text")).toHaveTextContent("line one");
    expect(screen.getByText("inline token")).toHaveClass("docs-inline-code");
    expect(
      screen.getByText("table cell").closest(".docs-table-wrap"),
    ).toBeTruthy();

    await screen.findByTestId("markdown-doc");
    expect(document.querySelector(".docs-mermaid-wrap svg")).toBeTruthy();
  });

  it("reuses the cached mermaid module across renders", async () => {
    render(<Docs />);
    await waitFor(() => {
      expect(document.querySelector(".docs-mermaid-wrap svg")).toBeTruthy();
    });

    cleanup();
    render(<Docs />);

    await waitFor(() => {
      expect(document.querySelector(".docs-mermaid-wrap svg")).toBeTruthy();
    });
    expect(mermaid.initialize).toHaveBeenCalledTimes(1);
  });

  it("shows the mermaid source when diagram rendering fails", async () => {
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error("bad diagram"));

    render(<Docs />);

    await waitFor(() => {
      expect(
        document.querySelector(".docs-mermaid-error code")?.textContent,
      ).toBe("flowchart TD\nA-->B");
    });
  });

  it("shows the mermaid source when the mermaid loader fails", async () => {
    resetDocsMermaidForTests(async () => {
      throw new Error("loader failed");
    });

    render(<Docs />);

    await waitFor(() => {
      expect(
        document.querySelector(".docs-mermaid-error code")?.textContent,
      ).toBe("flowchart TD\nA-->B");
    });
  });
});
