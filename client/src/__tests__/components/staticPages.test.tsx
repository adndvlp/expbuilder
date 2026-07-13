import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mermaid from "mermaid";
import Docs, { resetDocsMermaidForTests } from "../../pages/Docs";
import LandingPage from "../../pages/LandingPage";
import ErrorDetail from "../../pages/ErrorDetail";
import { openExternal } from "../../lib/openExternal";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  routeError: null as unknown,
  isRouteError: false,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
    useRouteError: () => routerMocks.routeError,
    isRouteErrorResponse: () => routerMocks.isRouteError,
    Link: ({ to, children, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children, language }: any) => (
    <pre data-testid={`syntax-${language}`}>{children}</pre>
  ),
}));

vi.mock("react-markdown", () => ({
  default: ({ children, components }: any) => (
    <div data-testid="markdown-doc">
      <div>{children}</div>
      {components.code({
        className: "language-mermaid",
        children: "flowchart TD\nA-->B\n",
      })}
      {components.code({
        className: "language-js",
        children: "const value = 1;\n",
      })}
      {components.code({ children: "line one\nline two\n" })}
      {components.code({ children: "inline token" })}
      {components.table({
        children: (
          <tbody>
            <tr>
              <td>table cell</td>
            </tr>
          </tbody>
        ),
      })}
    </div>
  ),
}));

describe("Docs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDocsMermaidForTests();
    vi.mocked(mermaid.render).mockResolvedValue({ svg: "<svg></svg>" });
  });

  afterEach(() => {
    cleanup();
    resetDocsMermaidForTests();
  });

  it("filters sections, changes the active section and navigates back home", () => {
    render(<Docs />);

    expect(screen.getByText("Builder Documentation")).toBeInTheDocument();
    expect(screen.getByText("Anatomy of the Generated HTML")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search/), {
      target: { value: "WebGazer" },
    });

    expect(screen.getByText("WebGazer (Eye Tracking)")).toBeInTheDocument();
    expect(
      screen.queryByText("Anatomy of the Generated HTML"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("WebGazer (Eye Tracking)"));

    expect(screen.getByText(/The eye tracking module generates/)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Toggle sidebar"));

    expect(screen.queryByPlaceholderText(/Search/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Dashboard/));

    expect(routerMocks.navigate).toHaveBeenCalledWith("/home");
  });

  it("shows an empty search state when no section matches", () => {
    render(<Docs />);

    fireEvent.change(screen.getByPlaceholderText(/Search/), {
      target: { value: "no matching section" },
    });

    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("renders markdown code variants, tables and mermaid diagrams", async () => {
    render(<Docs />);

    expect(screen.getByTestId("syntax-js")).toHaveTextContent("const value = 1;");
    expect(screen.getByTestId("syntax-text")).toHaveTextContent("line one");
    expect(screen.getByText("inline token")).toHaveClass("docs-inline-code");
    expect(screen.getByText("table cell").closest(".docs-table-wrap")).toBeTruthy();

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
      expect(document.querySelector(".docs-mermaid-error code")?.textContent).toBe(
        "flowchart TD\nA-->B",
      );
    });
  });

  it("shows the mermaid source when the mermaid loader fails", async () => {
    resetDocsMermaidForTests(async () => {
      throw new Error("loader failed");
    });

    render(<Docs />);

    await waitFor(() => {
      expect(document.querySelector(".docs-mermaid-error code")?.textContent).toBe(
        "flowchart TD\nA-->B",
      );
    });
  });

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
      resolveRender({ svg: "<svg data-late=\"true\"></svg>" });
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

describe("LandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    delete (window as any).electron;
  });

  it("links users into the dashboard and opens external links in the browser", () => {
    render(<LandingPage />);

    expect(screen.getByText("Welcome to Builder")).toBeInTheDocument();
    expect(screen.getByText("Get Started")).toHaveAttribute("href", "/home");

    fireEvent.click(screen.getByTitle("GitHub Profile"));

    expect(window.open).toHaveBeenCalledWith("https://github.com/adndvlp", "_blank");
  });

  it("uses Electron openExternal when available", () => {
    (window as any).electron = {
      openExternal: vi.fn(),
    };

    render(<LandingPage />);

    fireEvent.click(screen.getByAltText("UNAM").closest("a")!);

    expect((window as any).electron.openExternal).toHaveBeenCalledWith(
      "https://www.unam.mx/",
    );
    expect(window.open).not.toHaveBeenCalled();
  });

  it("falls back to window.open when Electron openExternal is unavailable", () => {
    openExternal("https://example.test/fallback");

    expect(window.open).toHaveBeenCalledWith(
      "https://example.test/fallback",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("updates inline hover styles across landing links", () => {
    render(<LandingPage />);

    const getStarted = screen.getByText("Get Started");
    fireEvent.mouseOver(getStarted);
    expect(getStarted).toHaveStyle({ background: "#b7950b" });
    fireEvent.mouseOut(getStarted);
    expect(getStarted).toHaveStyle({ color: "#fff" });

    const donate = screen.getByText(/Donate on Open Collective/).closest("a")!;
    fireEvent.mouseOver(donate);
    expect(donate).toHaveStyle({ backgroundColor: "#d4af37" });
    fireEvent.mouseOut(donate);
    expect(donate.style.backgroundColor).toBe("transparent");
    fireEvent.click(donate);
    expect(window.open).toHaveBeenCalledWith("https://opencollective.com/", "_blank");

    const unam = screen.getByAltText("UNAM").closest("a")!;
    fireEvent.mouseOver(unam);
    expect(unam).toHaveStyle({ opacity: "1" });
    fireEvent.mouseOut(unam);
    expect(unam).toHaveStyle({ opacity: "0.8" });

    for (const title of ["GitHub Profile", "LinkedIn Profile", "Email Me"]) {
      const iconLink = screen.getByTitle(title);
      fireEvent.mouseOver(iconLink);
      expect(iconLink).toHaveStyle({ color: "#d4af37" });
      fireEvent.mouseOut(iconLink);
      expect(iconLink).toHaveStyle({ color: "#fff" });
      fireEvent.click(iconLink);
    }

    const repo = screen.getByText(/View Project Repo/).closest("a")!;
    fireEvent.mouseOver(repo);
    expect(repo).toHaveStyle({ textDecoration: "underline" });
    fireEvent.mouseOut(repo);
    expect(repo).toHaveStyle({ textDecoration: "none" });
    fireEvent.click(repo);

    expect(window.open).toHaveBeenCalledWith(
      "https://www.linkedin.com/in/andpacheco/",
      "_blank",
    );
    expect(window.open).toHaveBeenCalledWith(
      "mailto:andngdv.lpr@gmail.com",
      "_blank",
    );
    expect(window.open).toHaveBeenCalledWith(
      "https://github.com/adndvlp/expbuilder",
      "_blank",
    );
  });
});

describe("ErrorDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    routerMocks.routeError = null;
    routerMocks.isRouteError = false;
  });

  it("renders the route error response state with a home link", () => {
    routerMocks.routeError = { status: 404 };
    routerMocks.isRouteError = true;

    render(<ErrorDetail />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.getByText("Back to home")).toHaveAttribute("href", "/");
  });

  it("renders normal Error instances with their message", () => {
    routerMocks.routeError = new Error("Loader failed");

    render(<ErrorDetail />);

    expect(
      screen.getByText("An error occurred: Loader failed"),
    ).toBeInTheDocument();
  });

  it("renders a generic fallback for unknown errors", () => {
    routerMocks.routeError = "unknown";

    render(<ErrorDetail />);

    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  });
});
