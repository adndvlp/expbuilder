import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Docs from "../../pages/Docs";
import LandingPage from "../../pages/LandingPage";
import ErrorDetail from "../../pages/ErrorDetail";

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

describe("Docs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
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
