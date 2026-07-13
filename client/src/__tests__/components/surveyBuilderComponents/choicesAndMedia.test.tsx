import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestionHarness } from "./testHarness";

describe("Survey Builder choices and uploaded media", () => {
  it("edits choice questions, required state and action buttons", () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    const { container } = render(
      <QuestionHarness
        initial={{
          type: "radiogroup",
          name: "q_choice",
          title: "Pick one",
          choices: ["A"],
          isRequired: false,
        }}
        onMove={onMove}
        onDelete={onDelete}
      />,
    );

    fireEvent.change(container.querySelector("select")!, {
      target: { value: "checkbox" },
    });
    fireEvent.change(screen.getByPlaceholderText("question_id"), {
      target: { value: "q_multi" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your question"), {
      target: { value: "Pick several" },
    });
    fireEvent.click(screen.getByLabelText("Required question"));
    fireEvent.change(screen.getByDisplayValue("A"), {
      target: { value: "Option A" },
    });
    fireEvent.click(screen.getByText("Add Option"));
    fireEvent.click(screen.getAllByTitle("Remove option")[0]);
    fireEvent.click(screen.getByText("Move Up"));
    fireEvent.click(screen.getByText("Move Down"));
    fireEvent.click(screen.getByText("Delete"));

    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"type":"checkbox"',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"name":"q_multi"',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"title":"Pick several"',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"isRequired":true',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent('"choices"');
    expect(onMove).toHaveBeenCalledWith("up");
    expect(onMove).toHaveBeenCalledWith("down");
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("starts choice questions without options from an empty state", () => {
    render(
      <QuestionHarness
        initial={{
          type: "radiogroup",
          name: "q_empty_choices",
          title: "Empty choices",
        }}
      />,
    );

    expect(
      screen.getByText('No options yet. Click "Add Option" to start.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Add Option"));

    expect(screen.getByPlaceholderText("Option 1")).toBeInTheDocument();
  });

  it("edits image-picker choices and media display settings from uploaded files", () => {
    const uploadedFiles: UploadedFile[] = [
      { name: "cat.png", url: "uploads/cat.png", type: "image/png" },
      { name: "movie.mp4", url: "uploads/movie.mp4", type: "video/mp4" },
      { name: "notes.csv", url: "uploads/notes.csv", type: "csv" },
    ];
    const { container } = render(
      <QuestionHarness
        initial={{
          type: "imagepicker",
          name: "q_images",
          title: "Pick image",
          choices: [{ value: "Cat", text: "Cat", imageLink: "" }],
        }}
        uploadedFiles={uploadedFiles}
      />,
    );

    const selects = container.querySelectorAll<HTMLSelectElement>("select");
    fireEvent.change(selects[1], {
      target: { value: "http://localhost:3000/uploads/cat.png" },
    });

    expect(screen.getByTestId("question-json")).toHaveTextContent(
      "http://localhost:3000/uploads/cat.png",
    );

    fireEvent.change(selects[0], { target: { value: "image" } });
    const updatedSelects =
      container.querySelectorAll<HTMLSelectElement>("select");
    fireEvent.change(updatedSelects[1], {
      target: { value: "http://localhost:3000/uploads/movie.mp4" },
    });
    fireEvent.change(screen.getByPlaceholderText("300 or 100%"), {
      target: { value: "640" },
    });
    fireEvent.change(screen.getByPlaceholderText("200 or auto"), {
      target: { value: "360" },
    });
    fireEvent.change(updatedSelects[2], { target: { value: "cover" } });
    fireEvent.change(updatedSelects[3], { target: { value: "video" } });

    expect(screen.getByText("Image/Video Source")).toBeInTheDocument();
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"type":"image"',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"imageWidth":"640"',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"imageHeight":"360"',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"imageFit":"cover"',
    );
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      '"contentMode":"video"',
    );
  });
});
