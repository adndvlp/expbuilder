import {
  registerErrordetailHooks,
  registerLandingpageHooks,
  routerMocks,
} from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "../../../pages/LandingPage";
import ErrorDetail from "../../../pages/ErrorDetail";
import { openExternal } from "../../../lib/openExternal";

describe("LandingPage", () => {
  registerLandingpageHooks();

  it("links users into the dashboard and opens external links in the browser", () => {
    render(<LandingPage />);

    expect(screen.getByText("Welcome to Builder")).toBeInTheDocument();
    expect(screen.getByText("Get Started")).toHaveAttribute("href", "/home");

    fireEvent.click(screen.getByTitle("GitHub Profile"));

    expect(window.open).toHaveBeenCalledWith(
      "https://github.com/adndvlp",
      "_blank",
    );
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
    expect(window.open).toHaveBeenCalledWith(
      "https://opencollective.com/",
      "_blank",
    );

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
  registerErrordetailHooks();

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

    expect(
      screen.getByText("An unexpected error occurred."),
    ).toBeInTheDocument();
  });
});
