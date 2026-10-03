export const typed = (value: unknown) => ({ source: "typed", value });
export const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=";

export function responsiveScene(legacySize?: unknown) {
  return {
    ...(legacySize == null ? {} : { __canvasStyles: typed(legacySize) }),
    components: typed([
      {
        type: "HtmlComponent",
        name: typed("edge"),
        coordinates: { x: -88, y: 88 },
        stimulus: typed('<p style="margin:0;font-size:2vw">HTML</p>'),
      },
      {
        type: "ImageComponent",
        name: typed("picture"),
        coordinates: { x: 50, y: 55 },
        stimulus: typed(image),
        width: 10,
        height: 10,
      },
      {
        type: "TextComponent",
        name: typed("text"),
        coordinates: { x: 0, y: 65 },
        text: typed("Responsive text"),
        width: 40,
        font_size: typed(99),
        _font_size_runtime_vw: typed(2),
      },
      {
        type: "TextComponent",
        name: typed("cloze"),
        coordinates: { x: -45, y: 20 },
        text: typed("%answer%"),
        _font_size_runtime_vw: typed(2),
        allow_blanks: typed(true),
      },
    ]),
    response_components: typed([
      {
        type: "InputResponseComponent",
        name: typed("answer"),
        component_id: "answer",
        coordinates: { x: 0, y: -10 },
        text: typed("%answer%"),
        allow_blanks: typed(true),
        case_sensitivity: typed(true),
        width: 35,
        height: 4,
        _input_font_size_runtime_vw: typed(2),
      },
      {
        type: "SliderResponseComponent",
        name: typed("slider"),
        component_id: "slider",
        coordinates: { x: 0, y: -40 },
        width: 40,
        height: 8,
        labels: typed(["Low", "High"]),
        slider_start: typed(25),
      },
      {
        type: "ButtonResponseComponent",
        name: typed("finish"),
        component_id: "finish",
        coordinates: { x: 55, y: -70 },
        choices: typed(["Continue"]),
        width: 18,
        height: 6,
        _button_font_size_runtime_vw: typed(1.8),
      },
    ]),
    response_ends_trial: typed(true),
  };
}
