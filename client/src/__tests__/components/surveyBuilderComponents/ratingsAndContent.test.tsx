import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionHarness } from "./testHarness";

describe("Survey Builder ratings and content fields", () => {
  it("edits rating settings, custom rate values and HTML content", () => {
    const { container, rerender } = render(
      <QuestionHarness
        initial={{
          type: "rating",
          name: "q_rating",
          title: "Rate it",
          rateMin: 1,
          rateMax: 5,
        }}
      />,
    );

    fireEvent.change(container.querySelectorAll("select")[1], {
      target: { value: "buttons" },
    });
    fireEvent.change(screen.getByDisplayValue("1"), { target: { value: "0" } });
    fireEvent.change(screen.getByDisplayValue("5"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g., Not at all"), {
      target: { value: "Low" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g., Extremely"), {
      target: { value: "High" },
    });
    fireEvent.click(screen.getByText("Add Value"));
    fireEvent.change(screen.getByPlaceholderText("Value 1 label"), {
      target: { value: "Agree" },
    });
    fireEvent.click(screen.getByTitle("Remove value"));

    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"displayMode":"buttons"',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"rateMin":0',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"rateMax":10',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"minRateDescription":"Low"',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"maxRateDescription":"High"',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"rateValues":[]',
    );

    rerender(
      <QuestionHarness
        key="html-question"
        initial={{
          type: "html",
          name: "q_html",
          html: "<p>Existing</p>",
        }}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("<p>Your HTML content...</p>"),
      {
        target: { value: "<p>Typed HTML</p>" },
      },
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      "<p>Typed HTML</p>",
    );

    fireEvent.click(screen.getByText("Visual Editor"));
    expect(
      screen.getByRole("dialog", { name: "Design HTML Content" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apply visual HTML"));
    fireEvent.click(screen.getByText("Close visual HTML"));

    expect(screen.getByTestId("question-json")).toHaveTextContent(
      "<section>Visual HTML</section>",
    );
  });

  it("defaults missing rating bounds and preserves zero bounds", () => {
    const { rerender } = render(
      <QuestionHarness
        initial={{
          type: "rating",
          name: "q_default_rating",
          title: "Default rating",
        }}
      />,
    );

    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();

    rerender(
      <QuestionHarness
        key="zero-rating"
        initial={{
          type: "rating",
          name: "q_zero_rating",
          title: "Zero rating",
          rateMin: 0,
          rateMax: 0,
        }}
      />,
    );

    const bounds = screen.getAllByRole("spinbutton");
    expect(bounds[0]).toHaveValue(0);
    expect(bounds[1]).toHaveValue(0);
  });

  it("renders empty question title and HTML values", () => {
    const { rerender } = render(
      <QuestionHarness
        initial={{
          type: "html",
          name: "q_empty_html",
        }}
      />,
    );

    expect(
      screen.getByPlaceholderText("<p>Your HTML content...</p>"),
    ).toHaveValue("");

    rerender(
      <QuestionHarness
        key="empty-title"
        initial={{
          type: "text",
          name: "q_empty_title",
        }}
      />,
    );

    expect(screen.getByPlaceholderText("Enter your question")).toHaveValue("");
  });

  it("edits comment row count", () => {
    render(
      <QuestionHarness
        initial={{
          type: "comment",
          name: "q_comment",
          title: "Explain",
          rows: 3,
        }}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("3"), {
      target: { value: "8" },
    });

    expect(screen.getByTestId("question-json")).toHaveTextContent('"rows":8');
  });
});
