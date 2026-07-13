import type { ComponentType } from "../types";

export const getDefaultConfig = (type: ComponentType): Record<string, any> => {
  const v = (value: any) => ({ source: "typed" as const, value });

  const defaults: Partial<Record<ComponentType, Record<string, any>>> = {
    ButtonResponseComponent: {
      choices: v(["Button"]),
      button_color: v("#e7e7e7"),
      button_text_color: v("#000000"),
      button_font_size: v(14),
      button_border_radius: v(3),
      button_border_color: v("#999999"),
      button_border_width: v(1),
      button_padding: v("6px 14px"),
    },
    TextComponent: {
      text: v("Text"),
      font_color: v("#000000"),
      font_size: v(16),
      font_family: v("sans-serif"),
      font_weight: v("normal"),
      font_style: v("normal"),
      text_align: v("center"),
      line_height: v(1.5),
      background_color: v("transparent"),
      padding: v("0px"),
      border_radius: v(0),
      border_color: v("transparent"),
      border_width: v(0),
    },
    HtmlComponent: {
      stimulus: v("<p>HTML</p>"),
    },
    ImageComponent: {
      stimulus: v(""),
    },
    SliderResponseComponent: {
      min: v(0),
      max: v(100),
      slider_start: v(50),
      step: v(1),
      labels: v(["0", "50", "100"]),
      slider_width: v(300),
    },
    KeyboardResponseComponent: {
      choices: v("ALL_KEYS"),
    },
    InputResponseComponent: {
      text: v("%%"),
      check_answers: v(false),
      allow_blanks: v(true),
    },
    FileUploadResponseComponent: {
      accept: v("pdf, csv"),
      multiple: v(false),
      button_label: v("Upload File"),
      show_preview: v(true),
    },
    AudioComponent: {
      stimulus: v(""),
    },
    VideoComponent: {
      stimulus: v([""]),
    },
    SketchpadComponent: {
      canvas_shape: v("rectangle"),
      canvas_width: v(400),
      canvas_height: v(300),
      canvas_border_width: v(2),
      canvas_border_color: v("#000000"),
      background_color: v("#ffffff"),
      stroke_width: v(3),
      stroke_color: v("#000000"),
      show_clear_button: v(true),
      clear_button_label: v("Clear"),
      show_undo_button: v(true),
      undo_button_label: v("Undo"),
    },
    SurveyComponent: {
      survey_json: v({
        pages: [
          {
            elements: [
              {
                type: "text",
                name: "question1",
                title: "Your question here",
              },
            ],
          },
        ],
      }),
    },
    ClickResponseComponent: {
      capture_full_screen: v(true),
      show_click_marker: v(false),
      marker_color: v("#e74c3c"),
      marker_radius: v(8),
      zIndex: v(10),
    },
  };

  return defaults[type] ?? {};
};
