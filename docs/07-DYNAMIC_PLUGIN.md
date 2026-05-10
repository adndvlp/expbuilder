# 07 - Dynamic Plugin

The DynamicPlugin (`server/dynamicplugin/index.ts`) is the most complex plugin in the system. It allows building custom trials by combining visual stimulus components and response components on a flexible canvas.

## Architecture

### Core Class: `DynamicPlugin`

Implements `JsPsychPlugin<Info>` with a single `trial()` method.

### Plugin Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `__canvasStyles` | COMPLEX | `{width:1024, height:768}` | Virtual canvas dimensions |
| `components` | COMPLEX[] | `[]` | Array of stimulus component configs |
| `response_components` | COMPLEX[] | `[]` | Array of response component configs |
| `require_response` | BOOL | `false` | Require all response components to pass validation |
| `trial_duration` | INT | `null` | Time limit in ms |
| `response_ends_trial` | BOOL | `true` | End on participant response |

---

## Component System

### Base Component Interface

Each component (stimulus or response) follows this contract:

```typescript
interface Component {
  render(container: HTMLElement, config: ComponentConfig, onResponse: () => void): void;
  getResponse?(): any;
  getRT?(): number;
  recordResponse?(config: ComponentConfig): void;
  isValid?(config: ComponentConfig): boolean;
  showValidationError?(): void;
  clearValidationError?(): void;
  reset?(): void;
  destroy(): void;
}
```

### ComponentConfig
```typescript
type ComponentConfig = {
  type: string;           // Component type name
  name?: string;         // Auto-assigned: "Type_N" (e.g., "ImageComponent_1")
  coordinates?: { x: number; y: number };  // Position (-100 to 100)
  zIndex?: number;       // Layer order
  width?: number;        // Width in pixels
  height?: number;       // Height in pixels
  screenLayouts?: Record<string, ScreenLayout>;  // Per-screen-size layouts
  __canvasStyles?: { width: number; height: number };  // Canvas dimensions
  // ... component-specific params
};
```

---

## Stimulus Components

### 1. ImageComponent
Displays an image. Parameters: `stimulus` (URL/file), `width`, `height`, `maintain_aspect_ratio`, `coordinates`

### 2. VideoComponent
Plays a video. Parameters: `stimulus` (URL/file), `width`, `height`, `autoplay`, `controls`, `loop`, `coordinates`

### 3. HtmlComponent
Renders arbitrary HTML. Parameters: `html` (HTML string), `coordinates`

### 4. TextComponent
Displays text. Parameters: `text` (string), `font_size`, `font_color`, `font_family`, `text_align`, `coordinates`

### 5. AudioComponent
Plays audio. Parameters: `stimulus` (URL/file), `autoplay`, `loop`, `controls`

### 6. SketchpadComponent
Drawing canvas. Parameters: `canvas_width`, `canvas_height`, `stroke_color`, `stroke_width`, `background_color`, `coordinates`
- For surveys/not capture trial: shown alongside other components, captures drawing
- For capture mode: replaces other components, only drawing area shown

---

## Response Components

### 1. ButtonResponseComponent
Clickable buttons. Parameters: `choices` (button labels array), `button_html`, `margin_vertical`, `margin_horizontal`, `coordinates`

### 2. ClickResponseComponent
Click/tap anywhere. Parameters: `target` (null=anywhere), `coordinates`
- Response: `{ x: number, y: number, is_touch: boolean }`

### 3. SliderResponseComponent
Slider input. Parameters: `min`, `max`, `step`, `labels`, `slider_width`, `start`, `require_movement`, `coordinates`
- Data: `{ response: number, rt: number, slider_start: number }`

### 4. KeyboardResponseComponent
Keyboard input. Parameters: `choices` (allowed keys), `coordinates`
- Accepts Space/Enter by default

### 5. InputResponseComponent
Text input. Parameters: `placeholder`, `input_type` (text/number/email/password), `allow_blanks`, `coordinates`

### 6. SurveyComponent
Full interactive survey using SurveyJS (`survey-core` + `survey-js-ui`). Renders a complete survey form with support for 10 question types, multi-page navigation, validation, and theming.

**Parameters:** `survey_json` (SurveyJS JSON object, NOT string), `survey_function` (optional JS function), `validation_function` (optional), `min_width`, `coordinates`, `zIndex`

**Data output:** Each question response becomes a separate flat column: `SurveyComponent_1_{questionName}`

#### Survey JSON Schema

The `survey_json` parameter accepts a SurveyJS-compatible JSON object:

```json
{
  "title": "My Survey",
  "description": "Please answer the following questions.",
  "showProgressBar": "top",
  "completeText": "Submit",
  "elements": [
    { "type": "text", "name": "q1", "title": "Your name?", "isRequired": true }
  ],
  "themeVariables": {
    "--sjs-primary-backcolor": "#1ab394",
    "--sjs-corner-radius": "4px"
  }
}
```

#### Survey-level Properties

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | Survey title |
| `description` | string | Optional instructions |
| `completeText` | string | Submit button text |
| `showProgressBar` | string | `"top"`, `"bottom"`, `"both"` |
| `elements` | Question[] | Array of question objects |
| `pages` | Page[] | Multi-page: array of `{ name, elements[] }` |
| `themeVariables` | object | CSS custom properties for styling |

#### Question Types

| Type | Label | Key Properties | Response |
|------|-------|---------------|----------|
| `text` | Text Input | `inputType` ("text"/"number"/"email"), `placeholder`, `maxLength` | String |
| `comment` | Long Text | `rows` (default 4) | String |
| `radiogroup` | Single Choice | `choices[]`, `displayMode` ("auto"/"buttons") | String |
| `checkbox` | Multiple Choice | `choices[]`, `showSelectAllItem` | String[] |
| `dropdown` | Dropdown | `choices[]` | String |
| `imagepicker` | Image Picker | `choices[]` with `imageLink` per choice, `contentMode` | String |
| `rating` | Rating Scale | `rateMin`, `rateMax`, `rateValues[]`, `minRateDescription`, `maxRateDescription` | Number |
| `boolean` | Yes/No | — | Boolean |
| `image` | Image Display | `imageLink`, `imageWidth`, `imageHeight`, `imageFit`, `contentMode` | No response |
| `html` | Custom HTML | `html` (HTML string) | No response |

#### Question Object

```typescript
type Question = {
  type: string;          // One of the 10 types above
  name: string;          // Unique identifier → data column name
  title?: string;        // Question text
  description?: string;  // Help text
  isRequired?: boolean;  // Default: false
  
  // Choices (radiogroup, checkbox, dropdown, imagepicker)
  choices?: (string | { value: string; text: string; imageLink?: string })[];
  displayMode?: "auto" | "buttons";
  
  // Rating
  rateMin?: number;
  rateMax?: number;
  rateValues?: { value: string; text: string }[];
  minRateDescription?: string;
  maxRateDescription?: string;
  
  // Image/Video
  imageLink?: string;
  imageWidth?: string | number;
  imageHeight?: string | number;
  imageFit?: "none" | "contain" | "cover" | "fill";
  contentMode?: "auto" | "image" | "video" | "youtube";
  
  // HTML
  html?: string;
  
  // Text input
  inputType?: "text" | "number" | "email" | "password";
  placeholder?: string;
  maxLength?: number;
  
  // Long text
  rows?: number;
};
```

#### LLM-Ready Examples

**Simple demographics:**
```json
{
  "title": "Demographics",
  "elements": [
    { "type": "text", "name": "age", "title": "Your age?", "inputType": "number", "isRequired": true },
    { "type": "radiogroup", "name": "gender", "title": "Gender?", "isRequired": true,
      "choices": ["Male", "Female", "Non-binary", "Prefer not to say"] }
  ]
}
```

**Likert scale:**
```json
{
  "title": "Satisfaction",
  "elements": [
    { "type": "rating", "name": "satisfaction", "title": "How satisfied?",
      "rateMin": 1, "rateMax": 7,
      "minRateDescription": "Very dissatisfied",
      "maxRateDescription": "Very satisfied",
      "isRequired": true }
  ]
}
```

**Image picker:**
```json
{
  "title": "Image Selection",
  "elements": [
    { "type": "imagepicker", "name": "preferred", "title": "Which do you prefer?",
      "choices": [
        { "value": "a", "text": "Option A", "imageLink": "img/a.jpg" },
        { "value": "b", "text": "Option B", "imageLink": "img/b.jpg" }
      ]}
  ]
}
```

**Multi-page with theme:**
```json
{
  "title": "Product Feedback",
  "showProgressBar": "top",
  "pages": [
    { "name": "p1", "elements": [
      { "type": "rating", "name": "ease", "title": "Ease of use?", "rateMin": 1, "rateMax": 5 }
    ]},
    { "name": "p2", "elements": [
      { "type": "checkbox", "name": "features", "title": "Features used?",
        "choices": ["Search", "Filter", "Export"] },
      { "type": "comment", "name": "suggestions", "title": "Improvements?", "rows": 4 }
    ]}
  ],
  "themeVariables": { "--sjs-primary-backcolor": "#4a90d9", "--sjs-corner-radius": "8px" }
}
```

**Display image + question:**
```json
{
  "title": "Stimulus",
  "elements": [
    { "type": "image", "name": "stim", "imageLink": "img/face.jpg",
      "imageWidth": 400, "imageHeight": 400, "imageFit": "contain" },
    { "type": "radiogroup", "name": "emotion", "title": "Emotion?",
      "isRequired": true, "choices": ["Happy", "Sad", "Neutral"] }
  ]
}
```

#### How to Embed via API

```typescript
// The survey lives inside a DynamicPlugin trial's columnMapping
await fetch(`/api/trial/${experimentID}/${trialId}`, {
  method: "PATCH",
  body: JSON.stringify({
    columnMapping: {
      response_components: {
        source: "typed",
        value: [{
          name: { source: "typed", value: "SurveyComponent_1" },
          type: { source: "typed", value: "SurveyComponent" },
          survey_json: { source: "typed", value: { /* survey JSON here */ } },
          coordinates: { source: "typed", value: { x: 0, y: 0 } },
          min_width: { source: "typed", value: "min(100vw, 800px)" },
          zIndex: { source: "typed", value: 0 }
        }]
      },
      trial_duration: { source: "typed", value: null },
      response_ends_trial: { source: "typed", value: true },
      __canvasStyles: { source: "typed", value: { width: 1024, height: 768 } }
    }
  })
});
```

### 7. AudioResponseComponent
Audio recording. Parameters: `max_duration`, `allow_playback`, `record_button_text`, `stop_button_text`, `coordinates`
- Data: `{ response: "audio captured", audio_url: string, estimated_stimulus_onset: number }`

### 8. FileUploadResponseComponent
File upload. Parameters: `accept` (file types), `max_file_size`, `multiple`, `button_text`, `coordinates`
- Data: `{ file_url: string, file_size: number, file_type: string }`

---

## Trial Execution Flow

```
1. Create container (#jspsych-dynamic-plugin-container)
2. Scale to viewport (based on __canvasStyles)
3. ResizeObserver for responsive scaling
4. Instantiate all components (via COMPONENT_MAP / RESPONSE_COMPONENT_MAP)
5. Auto-name components: "Type_1", "Type_2"...
6. Sort ALL components by zIndex
7. Resolve screen layouts for current viewport
8. Render all components in order
    ↓
9. Wait for response (or trial_duration timeout)
    ↓
10. On response:
    - If require_response: validate all response components
    - If any invalid: highlight errors, reset, wait again
    - If all valid: record responses, end trial
    ↓
11. Collect data from all components (flat structure)
12. Clean up: destroy components, disconnect observer
13. jsPsych.finishTrial(trialData)
```

---

## Data Collection (Flat Structure)

Unlike nested data, the DynamicPlugin outputs a **flat** data object:

```
{
  rt: 1234,                                          // Overall reaction time
  ImageComponent_1_type: "ImageComponent",
  ImageComponent_1_stimulus: "face.jpg",
  ImageComponent_1_coordinates: "{\"x\":320,\"y\":240}",
  ImageComponent_1_size: "{\"width\":200,\"height\":200}",
  TextComponent_1_type: "TextComponent",
  TextComponent_1_text: "Hello world",
  TextComponent_1_coordinates: "{\"x\":640,\"y\":400}",
  ButtonResponseComponent_1_type: "ButtonResponseComponent",
  ButtonResponseComponent_1_response: 0,             // Button index
  ButtonResponseComponent_1_rt: 1200,
  SurveyComponent_1_question1: "Answer to Q1",       // Per-question columns
  SurveyComponent_1_question2: "Answer to Q2",
  SketchpadComponent_1_strokes: "[...]",             // Sketch data
  SketchpadComponent_1_png: "data:image/png;base64,...",
  AudioResponseComponent_1_response: "audio captured",
  AudioResponseComponent_1_audio_url: "blob:...",
  FileUploadResponseComponent_1_file_url: "participant-files/file.pdf",
  FileUploadResponseComponent_1_file_size: 123456,
  FileUploadResponseComponent_1_file_type: "application/pdf"
}
```

### Naming Convention
`{ComponentType}_{index}_{field}` — auto-assigned during instantiation.

---

## Screen Layout Resolution

The `resolveScreenLayout()` function handles responsive design:
- Each component can have `screenLayouts: { "1024x768": {...}, "1920x1080": {...} }`
- At runtime, the layout closest to current viewport width (200px threshold) is selected
- Falls back to default `coordinates`, `width`, `height` if no match

---

## Visual Designer (Frontend)

The `TrialDesigner` component provides:

### Canvas
- Konva.js based drag-and-drop interface
- Components as draggable/resizable nodes
- Visual feedback for z-layer ordering

### Component Properties Panel
- Per-component configuration
- Parameter mapping to CSV columns or typed values
- Screen layout preset management

### Save
- On save: entire config goes into `columnMapping`
- `components` array → `columnMapping.components.value[]`
- `response_components` array → `columnMapping.response_components.value[]`
- Each component's params stored as `ColumnMappingEntry` objects
- General settings (trial_duration, etc.) also in `columnMapping`

### Tabs
- **Components**: Opens the visual designer
- **General Settings**: Standard ParameterMapper for trial-level params (trial_duration, response_ends_trial, require_response)
