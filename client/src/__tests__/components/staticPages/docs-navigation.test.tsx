import { registerDocsPageHooks, routerMocks } from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Docs from "../../../pages/Docs";

describe("Docs page", () => {
  registerDocsPageHooks();

  it("filters sections, changes the active section and navigates back home", () => {
    render(<Docs />);

    expect(screen.getByText("Builder Documentation")).toBeInTheDocument();
    expect(
      screen.getByText("Anatomy of the Generated HTML"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search/), {
      target: { value: "WebGazer" },
    });

    expect(screen.getByText("WebGazer (Eye Tracking)")).toBeInTheDocument();
    expect(
      screen.queryByText("Anatomy of the Generated HTML"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("WebGazer (Eye Tracking)"));

    expect(
      screen.getByText(/The eye tracking module generates/),
    ).toBeInTheDocument();

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
