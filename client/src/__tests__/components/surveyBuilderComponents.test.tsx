import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CustomSurveyEditor from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder";
import QuestionEditor from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder/QuestionEditor";
import ThemeCustomization from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder/ThemeCustomization";
import type {
  ChoiceItem,
  Question,
  RateValue,
  UploadedFile,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder/types";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/GrapesEditors/GrapesHtmlEditor",
  () => ({
    default: ({ isOpen, onClose, onChange, title }: any) =>
      isOpen ? (
        <div role="dialog" aria-label={title}>
          <button type="button" onClick={() => onChange("<section>Visual HTML</section>")}>
            Apply visual HTML
          </button>
          <button type="button" onClick={onClose}>
            Close visual HTML
          </button>
        </div>
      ) : null,
  }),
);

function SurveyHarness({
  initial,
  uploadedFiles,
  onChange,
}: {
  initial: Record<string, unknown>;
  uploadedFiles?: UploadedFile[];
  onChange?: (json: Record<string, unknown>) => void;
}) {
  const [surveyJson, setSurveyJson] = useState(initial);

  return (
    <>
      <CustomSurveyEditor
        surveyJson={surveyJson}
        uploadedFiles={uploadedFiles}
        onChange={(next) => {
          setSurveyJson(next);
          onChange?.(next);
        }}
      />
      <output data-testid="survey-json">{JSON.stringify(surveyJson)}</output>
    </>
  );
}

function QuestionHarness({
  initial,
  uploadedFiles = [],
  canMoveUp = true,
  canMoveDown = true,
  onMove = vi.fn(),
  onDelete = vi.fn(),
}: {
  initial: Question;
  uploadedFiles?: UploadedFile[];
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (direction: "up" | "down") => void;
  onDelete?: () => void;
}) {
  const [question, setQuestion] = useState(initial);

  function normalizeChoice(choice: string | ChoiceItem): ChoiceItem {
    if (typeof choice === "string") return { value: choice, text: choice, imageLink: "" };
    return choice;
  }

  function normalizeRateValue(rateValue: RateValue): RateValue {
    return rateValue;
  }

  return (
    <>
      <QuestionEditor
        question={question}
        index={0}
        isExpanded
        onToggleExpand={vi.fn()}
        onUpdate={(updates) => setQuestion((prev) => ({ ...prev, ...updates }))}
        onDelete={onDelete}
        onMove={onMove}
        onAddChoice={() =>
          setQuestion((prev) => ({
            ...prev,
            choices: [
              ...(prev.choices ?? []),
              { value: "", text: "", imageLink: "" },
            ],
          }))
        }
        onUpdateChoice={(choiceIndex, field, value) =>
          setQuestion((prev) => {
            const choices = (prev.choices ?? []).map(normalizeChoice);
            const current = choices[choiceIndex] ?? { value: "", text: "", imageLink: "" };
            choices[choiceIndex] = {
              ...current,
              [field]: value,
              ...(field === "text" ? { value } : {}),
            };
            return { ...prev, choices };
          })
        }
        onRemoveChoice={(choiceIndex) =>
          setQuestion((prev) => ({
            ...prev,
            choices: (prev.choices ?? []).filter((_, index) => index !== choiceIndex),
          }))
        }
        onAddRateValue={() =>
          setQuestion((prev) => ({
            ...prev,
            rateValues: [...(prev.rateValues ?? []), { value: "", text: "" }],
          }))
        }
        onUpdateRateValue={(rateIndex, value) =>
          setQuestion((prev) => {
            const rateValues = (prev.rateValues ?? []).map(normalizeRateValue);
            rateValues[rateIndex] = { value, text: value };
            return { ...prev, rateValues };
          })
        }
        onRemoveRateValue={(rateIndex) =>
          setQuestion((prev) => ({
            ...prev,
            rateValues: (prev.rateValues ?? []).filter((_, index) => index !== rateIndex),
          }))
        }
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        uploadedFiles={uploadedFiles}
      />
      <output data-testid="question-json">{JSON.stringify(question)}</output>
    </>
  );
}

describe("Survey Builder components", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("edits survey title, description, theme variables and adds a default question", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SurveyHarness
        initial={{
          title: "Initial survey",
          description: "Initial description",
          themeVariables: { "--sjs-general-forecolor": "#111111" },
          elements: [],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Enter survey title"), {
      target: { value: "Updated survey" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter survey description"), {
      target: { value: "Updated description" },
    });

    const colorInputs = container.querySelectorAll<HTMLInputElement>('input[type="color"]');
    fireEvent.change(colorInputs[0], { target: { value: "#abcdef" } });
    fireEvent.change(colorInputs[1], { target: { value: "#123456" } });
    fireEvent.change(colorInputs[2], { target: { value: "#fedcba" } });

    expect(
      screen.getByText('No questions yet. Click "Add Question" to start.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Add Question"));

    expect(screen.getByTestId("survey-json")).toHaveTextContent("Updated survey");
    expect(screen.getByTestId("survey-json")).toHaveTextContent("Updated description");
    expect(screen.getByTestId("survey-json")).toHaveTextContent("--sjs-primary-backcolor");
    expect(screen.getByTestId("survey-json")).toHaveTextContent("--sjs-general-forecolor");
    expect(screen.getByTestId("survey-json")).toHaveTextContent("--sjs-general-backcolor-dim");
    expect(screen.getByTestId("survey-json")).toHaveTextContent("question1");
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalled();
  });

  it("creates each theme variable when no theme object exists", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ThemeCustomization surveyJson={{}} onChange={onChange} />,
    );
    const colorInputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="color"]',
    );

    fireEvent.change(colorInputs[0], { target: { value: "#111111" } });
    fireEvent.change(colorInputs[1], { target: { value: "#222222" } });
    fireEvent.change(colorInputs[2], { target: { value: "#333333" } });

    expect(onChange).toHaveBeenNthCalledWith(1, {
      themeVariables: { "--sjs-primary-backcolor": "#111111" },
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      themeVariables: { "--sjs-general-forecolor": "#222222" },
    });
    expect(onChange).toHaveBeenNthCalledWith(3, {
      themeVariables: { "--sjs-general-backcolor-dim": "#333333" },
    });
  });

  it("shows an empty state when the survey has no elements field", () => {
    render(<SurveyHarness initial={{ title: "No elements yet" }} />);

    expect(
      screen.getByText('No questions yet. Click "Add Question" to start.'),
    ).toBeInTheDocument();
  });

  it("toggles, moves and deletes questions through CustomSurveyEditor", () => {
    render(
      <SurveyHarness
        initial={{
          elements: [
            { type: "text", name: "first", title: "First question" },
            { type: "comment", name: "second", title: "Second question" },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByText("First question"));
    expect(screen.getByPlaceholderText("Enter your question")).toBeInTheDocument();

    fireEvent.click(screen.getByText("First question"));
    expect(screen.queryByPlaceholderText("Enter your question")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("First question"));
    fireEvent.click(screen.getByText("Move Down"));
    const afterMove = JSON.parse(screen.getByTestId("survey-json").textContent || "{}");
    expect(afterMove.elements.map((q: Question) => q.name)).toEqual([
      "second",
      "first",
    ]);

    fireEvent.click(screen.getByText("Delete"));
    const afterDelete = JSON.parse(screen.getByTestId("survey-json").textContent || "{}");

    expect(afterDelete.elements).toHaveLength(1);
  });

  it("routes nested choice and rating updates through CustomSurveyEditor", () => {
    render(
      <SurveyHarness
        initial={{
          elements: [
            {
              type: "radiogroup",
              name: "choice_question",
              title: "Choice question",
              choices: ["A"],
            },
            {
              type: "rating",
              name: "rating_question",
              title: "Rating question",
              rateMin: 1,
              rateMax: 5,
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByText("Choice question"));
    fireEvent.change(screen.getByPlaceholderText("Enter your question"), {
      target: { value: "Updated choice question" },
    });
    fireEvent.click(screen.getByText("Add Option"));
    fireEvent.change(screen.getByDisplayValue("A"), {
      target: { value: "Option A" },
    });
    fireEvent.click(screen.getAllByTitle("Remove option")[0]);

    fireEvent.click(screen.getByText("Rating question"));
    fireEvent.click(screen.getByText("Add Value"));
    fireEvent.change(screen.getByPlaceholderText("Value 1 label"), {
      target: { value: "Neutral" },
    });
    fireEvent.click(screen.getByTitle("Remove value"));

    const updated = JSON.parse(
      screen.getByTestId("survey-json").textContent || "{}",
    );
    expect(updated.elements[0].title).toBe("Updated choice question");
    expect(updated.elements[0].choices).toEqual([
      { value: "", text: "", imageLink: "" },
    ]);
    expect(updated.elements[1].rateValues).toEqual([]);
  });

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

    expect(screen.getByTestId("question-json")).toHaveTextContent('"type":"checkbox"');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"name":"q_multi"');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"title":"Pick several"');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"isRequired":true');
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
    const updatedSelects = container.querySelectorAll<HTMLSelectElement>("select");
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
    expect(screen.getByTestId("question-json")).toHaveTextContent('"type":"image"');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"imageWidth":"640"');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"imageHeight":"360"');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"imageFit":"cover"');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"contentMode":"video"');
  });

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
    fireEvent.change(screen.getByDisplayValue("5"), { target: { value: "10" } });
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

    expect(screen.getByTestId("question-json")).toHaveTextContent('"displayMode":"buttons"');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"rateMin":0');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"rateMax":10');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"minRateDescription":"Low"');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"maxRateDescription":"High"');
    expect(screen.getByTestId("question-json")).toHaveTextContent('"rateValues":[]');

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

    fireEvent.change(screen.getByPlaceholderText("<p>Your HTML content...</p>"), {
      target: { value: "<p>Typed HTML</p>" },
    });
    expect(screen.getByTestId("question-json")).toHaveTextContent(
      "<p>Typed HTML</p>",
    );

    fireEvent.click(screen.getByText("Visual Editor"));
    expect(screen.getByRole("dialog", { name: "Design HTML Content" })).toBeInTheDocument();
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
