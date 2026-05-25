import { render, screen, waitFor } from "@testing-library/react";
import { Model } from "survey-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SurveyPreview from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Preview";

describe("SurveyPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an empty placeholder for missing survey JSON", () => {
    render(<SurveyPreview surveyJson={{}} />);

    expect(screen.getByText("Preview Area")).toBeInTheDocument();
    expect(
      screen.getByText("Your survey will appear here as you build it"),
    ).toBeInTheDocument();
    expect(Model).not.toHaveBeenCalled();
  });

  it("sanitizes rating and choice fields before creating the Survey model", async () => {
    const model = { instance: null as any, applyTheme: vi.fn() };
    vi.mocked(Model).mockImplementation(function (this: any) {
      this.mode = "edit";
      this.applyTheme = model.applyTheme;
      model.instance = this;
    } as any);
    const surveyJson = {
      title: "Survey",
      elements: [
        {
          type: "rating",
          name: "rating_null",
          rateValues: null,
        },
        {
          type: "rating",
          name: "rating_custom",
          rateMin: 1,
          rateMax: 7,
          rateValues: [
            null,
            { value: "A" },
            { text: "B" },
            { value: "", text: "" },
          ],
        },
        {
          type: "radiogroup",
          name: "radio",
          choices: ["yes", { value: "no" }, { text: "maybe", imageLink: "maybe.png" }],
        },
        {
          type: "checkbox",
          name: "bad_choices",
          choices: "not-array",
        },
      ],
    };

    render(<SurveyPreview surveyJson={surveyJson} />);

    await waitFor(() => {
      expect(Model).toHaveBeenCalled();
    });

    expect(vi.mocked(Model).mock.calls[0][0]).toEqual({
      title: "Survey",
      elements: [
        {
          type: "rating",
          name: "rating_null",
          rateValues: [],
          rateMin: 1,
          rateMax: 5,
        },
        {
          type: "rating",
          name: "rating_custom",
          rateValues: [
            { value: "A", text: "A" },
            { value: "B", text: "B" },
          ],
        },
        {
          type: "radiogroup",
          name: "radio",
          choices: [
            { value: "yes", text: "yes" },
            { value: "no", text: "no" },
            { value: "maybe", text: "maybe", imageLink: "maybe.png" },
          ],
        },
        {
          type: "checkbox",
          name: "bad_choices",
          choices: [],
        },
      ],
    });
    expect(model.instance.mode).toBe("display");
  });

  it("applies custom theme variables to the Survey model", async () => {
    const model = { instance: null as any, applyTheme: vi.fn() };
    vi.mocked(Model).mockImplementation(function (this: any) {
      this.mode = "edit";
      this.applyTheme = model.applyTheme;
      model.instance = this;
    } as any);

    render(
      <SurveyPreview
        surveyJson={{
          title: "Survey",
          themeVariables: {
            "--sjs-primary-backcolor": "#123456",
          },
          elements: [{ type: "text", name: "q1" }],
        }}
      />,
    );

    await waitFor(() => {
      expect(model.applyTheme).toHaveBeenCalledWith({
        cssVariables: {
          "--sjs-primary-backcolor": "#123456",
        },
        themeName: "plain",
        colorPalette: "light",
        isPanelless: false,
      });
    });
  });

  it("shows a preview error when survey-core rejects the JSON", async () => {
    vi.mocked(Model).mockImplementation(function () {
      throw new Error("Invalid schema");
    } as any);

    render(
      <SurveyPreview
        surveyJson={{
          title: "Broken",
          elements: [{ type: "unsupported", name: "q1" }],
        }}
      />,
    );

    expect(await screen.findByText(/Preview Error:/)).toBeInTheDocument();
    expect(screen.getByText(/Invalid schema/)).toBeInTheDocument();
  });
});
