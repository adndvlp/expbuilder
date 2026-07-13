export const DynamicPluginResponseAndRuntimeContent = `| \`show_undo\` | boolean | \`true\` | Show undo button |
| \`show_redo\` | boolean | \`true\` | Show redo button |
| \`show_clear\` | boolean | \`true\` | Show clear button |
| \`show_color_palette\` | boolean | \`true\` | Show color palette |
| \`palette_colors\` | string[] | \`[...]\` | Colors in the palette |

Generated data: \`SketchpadComponent_N_strokes\` (array of strokes) and \`SketchpadComponent_N_png\` (base64).

## Response Components (8)

Response components capture the participant's response and determine when the trial ends.

### ButtonResponseComponent

Clickable buttons with flexible layout. Standard button visuals are drawn in Canvas, with transparent native buttons overlaid for real interaction. Custom \`button_html\` uses the DOM path.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`choices\` | string[] | \`[]\` | Button texts |
| \`button_html\` | string | \`""\` | HTML template (\`{{choice}}\` = button text) |
| \`button_layout\` | string | \`"flex"\` | \`flex\`, \`grid\` |
| \`columns\` | number | \`1\` | Columns in grid mode |
| \`rows\` | number | \`1\` | Rows in grid mode |
| \`button_gap\` | number | \`10\` | Space between buttons (px) |
| \`button_color\` | string | \`"#4a90d9"\` | Background color |
| \`button_text_color\` | string | \`"#ffffff"\` | Text color |
| \`button_font_size\` | number | \`16\` | Font size (px) |
| \`button_font_family\` | string | \`"Arial"\` | Font family |
| \`button_border_radius\` | number | \`5\` | Border radius (px) |
| \`button_border_color\` | string | \`"transparent"\` | Border color |
| \`button_border_width\` | number | \`0\` | Border width (px) |
| \`button_padding\` | number | \`10\` | Internal padding (px) |
| \`button_image_width\` | number | \`50\` | Image width in button with image |
| \`button_image_height\` | number | \`50\` | Image height in button with image |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Data: \`ButtonResponseComponent_N_response\` (button text), \`ButtonResponseComponent_N_rt\`.

### KeyboardResponseComponent

Captures pressed keys.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`allowed_keys\` | string[] | \`[]\` | Allowed keys (empty = all) |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Data: \`KeyboardResponseComponent_N_response\` (key), \`KeyboardResponseComponent_N_rt\`.

### SliderResponseComponent

Range-type slider with labels. The visual slider is drawn in Canvas, with a transparent native range input overlaid for real interaction.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`min\` | number | \`0\` | Minimum value |
| \`max\` | number | \`100\` | Maximum value |
| \`step\` | number | \`1\` | Step |
| \`start\` | number | \`50\` | Initial value |
| \`label_left\` | string | \`""\` | Left label |
| \`label_right\` | string | \`""\` | Right label |
| \`show_value\` | boolean | \`true\` | Show numeric value |
| \`require_movement\` | boolean | \`true\` | Requires moving the slider |
| \`require_response\` | boolean | \`true\` | Requires response to advance |
| \`slider_color\` | string | \`"#4a90d9"\` | Bar color |
| \`slider_height\` | number | \`6\` | Bar height (px) |
| \`slider_width\` | number | \`300\` | Slider width (px) |
| \`slider_font_size\` | number | \`14\` | Label font size |

Data: \`SliderResponseComponent_N_response\` (number), \`SliderResponseComponent_N_rt\`.

### InputResponseComponent

Text field.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`input_label\` | string | \`""\` | Input label |
| \`input_type\` | string | \`"text"\` | \`text\`, \`number\`, \`date\`, \`time\`, \`password\` |
| \`input_placeholder\` | string | \`""\` | Placeholder |
| \`input_width\` | number | \`200\` | Input width (px) |
| \`input_font_size\` | number | \`16\` | Font size |
| \`input_font_color\` | string | \`"#000000"\` | Text color |
| \`input_border_color\` | string | \`"#cccccc"\` | Border color |
| \`input_border_radius\` | number | \`5\` | Border radius (px) |
| \`cloze_mode\` | boolean | \`false\` | Cloze mode (automatic correction) |
| \`cloze_answer\` | string | \`""\` | Correct cloze answer |
| \`cloze_case_sensitive\` | boolean | \`true\` | Case sensitive cloze |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Data: \`InputResponseComponent_N_response\` (text), \`InputResponseComponent_N_rt\`.

### ClickResponseComponent

Captures click/touch coordinates in the viewport. The capture layer is DOM-based; the optional response marker is drawn in Canvas.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`target\` | string | \`"fullscreen"\` | \`fullscreen\` or \`component_1\` (component ID) |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Data: \`ClickResponseComponent_N_response\` (array \`[x, y]\`), \`ClickResponseComponent_N_rt\`.

### AudioResponseComponent

Audio recording with microphone. Play/Pause, Done, Record Again buttons.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`max_duration\` | number | \`60000\` | Maximum recording duration (ms) |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Data: \`AudioResponseComponent_N_response\` (audio base64), \`AudioResponseComponent_N_rt\`.

### FileUploadResponseComponent

Participant file upload.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`allowed_types\` | string[] | \`[]\` | Allowed extensions (empty = all) |
| \`max_file_size\` | number | \`10\` | Maximum size in MB |
| \`require_response\` | boolean | \`true\` | Requires response to advance |

Uses \`window.JSPSYCH_FILE_UPLOAD_ENDPOINT\` as the upload destination.

Data: \`FileUploadResponseComponent_N_response\` (uploaded file URL).

### SurveyComponent

Full survey with SurveyJS. See dedicated section below.

## Positioning System

Components use normalized coordinates:

\`\`\`json
{
  "coordinates": { "x": 40, "y": 30 },
  "width": 20,
  "height": 10,
  "zIndex": 2,
  "rotation": 0
}
\`\`\`

- \`x\`, \`y\`: top-left corner position, in **vw** / **vh** (0–100)
- \`width\`, \`height\`: dimensions in **vw%** relative to the configured canvas width
- \`zIndex\`: stacking control (higher = on top)
- \`rotation\`: rotation degrees (0–360)

## Canvas Size and Scaling

The Trial Designer stores a fixed design canvas in \`__canvasStyles\`:

\`\`\`js
"__canvasStyles": {
  "backgroundColor": "#ffffff",
  "width": 1440,
  "height": 900,
  "fullScreen": true,
  "progressBar": false
}
\`\`\`

Component positions are saved as normalized coordinates. Width and height are saved as percentages relative to the design canvas width, so the runtime can recreate the visual layout at the participant's viewport size without saving separate per-device layout maps.

## stimulus_onset / stimulus_duration

Controls the temporal visibility of stimulus components:

\`\`\`js
{
  stimulus_onset: 500,      // ms from trial start when it appears
  stimulus_duration: 2000,  // ms it remains visible (null = until end of trial)
}
\`\`\`

- **Does not apply** to response components (always visible during the trial).
- If \`stimulus_duration\` is null, the component remains visible until the trial ends.
- Useful for priming, RSVP paradigms, or sequential stimulus presentation.

## Generated Data Format

### Standard DynamicPlugin
\`\`\`js
// Trial with ButtonResponseComponent (index 1) + SliderResponseComponent (index 2)
{
  trial_index: 5,
  rt: 1240,
  ButtonResponseComponent_1_response: "Option A",
  SliderResponseComponent_2_response: 65,
  trial_id: 123,
  builder_id: "uuid-abc",
}
\`\`\`

### SurveyComponent
\`\`\`js
{
  SurveyComponent_1_response: {
    question1: "Strongly agree",
    question2: "Neutral"
  }
}
\`\`\`

### SketchpadComponent
\`\`\`js
{
  SketchpadComponent_1_strokes: [{ points: [...], color: "#000", width: 4 }],
  SketchpadComponent_1_png: "data:image/png;base64,iVBORw0KG..."
}
\`\`\`

### FileUploadResponseComponent
\`\`\`js
{
  FileUploadResponseComponent_1_response: "https://storage.example.com/uploads/file.pdf"
}
`;
