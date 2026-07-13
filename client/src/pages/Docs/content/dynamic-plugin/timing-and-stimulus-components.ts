export const DynamicPluginTimingAndStimulusContent = `# Dynamic Plugin

Custom plugin that renders visual trials created in the **Trial Designer**. Replaces the standard plugin when the trial has components positioned on a canvas (images, buttons, text, etc.).

Source code: \`server/dynamicplugin/index.ts\`. Runs as a jsPsych plugin (\`type: DynamicPlugin\`).

## Runtime Timing Model

DynamicPlugin's timing path is designed for browser-based visual experiments:

\`\`\`txt
preload current-trial assets
prepare decoded image bitmaps when supported
build the trial while hidden
requestAnimationFrame()
use the frame timestamp as trial onset
show/draw visual stimuli on scheduled animation frames
measure real frame intervals
save desired-vs-actual timing diagnostics
prefetch upcoming DynamicPlugin assets in the background
\`\`\`

The timing system uses \`performance.now()\`/event timestamps for RT and \`requestAnimationFrame()\` for visual onset, stimulus duration, trial duration, and frame logging. It does not assume that every frame is \`16.667 ms\`; every reported frame interval is measured from the browser's animation-frame timestamps.

The main diagnostic fields are:

| Field | Meaning |
|---|---|
| \`timing_method\` | Reports \`performance.now + requestAnimationFrame\` |
| \`trial_onset_time\` | First animation-frame timestamp used as trial onset |
| \`actual_trial_duration\` | Observed trial duration from onset to offset |
| \`frame_intervals\` | JSON array of measured frame durations |
| \`mean_frame_interval\` | Mean observed frame duration |
| \`max_frame_interval\` | Largest observed frame duration |
| \`long_frame_count\` | Number of frames above the lag threshold |
| \`stimulus_timing\` | Desired-vs-actual onset, offset, duration, and error for visual stimuli |
| \`timing_quality\` | \`ok\`, \`warning\`, or \`bad\` |

## Canvas Rendering Path

The current runtime uses a shared \`CanvasStage\` for timing-critical visual drawing:

| Component | Runtime rendering path |
|---|---|
| \`ImageComponent\` | Preloads/decodes the image, prepares an \`ImageBitmap\` when available, and draws the image into Canvas at onset. |
| \`TextComponent\` | Plain text is drawn into Canvas. Cloze/input text still uses DOM because it needs real inputs. |
| \`ButtonResponseComponent\` | Standard button visuals are drawn into Canvas; transparent native buttons remain on top for click, focus, keyboard, and accessibility behavior. Custom \`button_html\` falls back to DOM. |
| \`SliderResponseComponent\` | Slider visuals are drawn into Canvas; a transparent native \`input[type=range]\` remains on top for real browser interaction. |
| \`ClickResponseComponent\` | Click/touch capture uses a DOM overlay; the optional response marker is drawn into Canvas. |
| \`SketchpadComponent\` | Uses its own drawing canvas because the participant draws into it. |
| \`HtmlComponent\`, \`SurveyComponent\`, \`InputResponseComponent\`, \`FileUploadResponseComponent\`, audio/video controls | Stay DOM/native because they require complex HTML, browser form controls, media controls, files, microphone, or SurveyJS. |

This means Canvas is used where it improves visual presentation timing and reduces HTML/CSS/layout work at stimulus onset. It is not used as a replacement for real browser input controls when the control must remain interactive.

## Empirical Timing Validation

Internal empirical validation compared Canvas image presentation against the older DOM image path under the same browser/device conditions.

Test design:

| Test detail | Value |
|---|---|
| Trials | 500 per renderer |
| Durations | 50, 100, 250, 500, 1000 ms |
| Repetitions | 100 per duration |
| Metric | Requested duration vs \`stimulus_timing.actual_duration\` |
| Diagnostics | \`duration_error\`, frame intervals, long frames, bad trials |

Observed result:

| Renderer | Exact trials | ±1 frame | ≥2 frame errors | Bad trials | Long frames | Mean error | SD |
|---|---:|---:|---:|---:|---:|---:|---:|
| Canvas image path | 86.6% | 13.4% | 0% | 0 | 0 | +2.48 ms | 5.58 ms |
| DOM image path | 83.2% | 16.8% | 0% | 0 | 0 | +2.94 ms | 6.13 ms |

Interpretation:

\`\`\`txt
Under the tested browser/device conditions, Canvas image presentation stayed
within ±1 refresh frame across 500 trials, with no 2+ frame errors, no bad
trials, and slightly lower mean error/variance than DOM image presentation.
\`\`\`

This is an empirical internal validation of browser-reported visual presentation timing. It is not a physical validation of pixel onset on the display.

## Comparison Scope

DynamicPlugin should be compared carefully:

| System | Strength |
|---|---|
| PsychoPy | Stronger physical/local control because it runs as desktop software with OpenGL/GPU presentation and closer control of the display environment. |
| lab.js | Browser-based, optimized around animation-frame timing, preloading, Canvas-based screens, and published external timing validation. |
| DynamicPlugin | Browser-based, uses animation-frame timing, preloading/prefetching, Canvas rendering for critical visual paths, and internal per-trial timing diagnostics. |

The correct claim is:

\`\`\`txt
DynamicPlugin + Canvas is architecturally comparable to lab.js for browser-based
visual presentation timing, and internal tests showed presentation errors within
±1 frame for the tested image timings.
\`\`\`

The stronger claim is not supported yet:

\`\`\`txt
DynamicPlugin is physically equal or superior to lab.js or PsychoPy.
\`\`\`

That would require external hardware validation.

## Timing Limits

DynamicPlugin records what the browser can observe. It cannot directly control or measure:

- physical pixel onset measured by a photodiode;
- monitor scanout and display processing;
- keyboard polling rate;
- mouse/touch hardware sampling rate;
- OS/browser event queue delays;
- browser timer resolution reductions;
- background-tab throttling;
- CPU/GPU contention;
- participant hardware and drivers.

For physical validation, use an external setup:

\`\`\`txt
photodiode on screen
instrumented key/button
microcontroller or oscilloscope
compare physical onset/response against saved DynamicPlugin timing fields
\`\`\`

## Stimulus Components (6)

Stimulus components are rendered but do not capture the participant's response.

### TextComponent

Static text with full styling. Plain text is rendered through the Canvas path at runtime; cloze/input text uses DOM because the participant must type into real inputs.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`text\` | string | \`""\` | Text content (supports basic HTML) |
| \`font_size\` | number | \`16\` | Size in px (relative to canvas) |
| \`font_color\` | string | \`"#000000"\` | Text color (hex, rgb, name) |
| \`font_family\` | string | \`"Arial"\` | Font family |
| \`font_style\` | string | \`"normal"\` | \`normal\`, \`italic\`, \`oblique\` |
| \`font_weight\` | string | \`"normal"\` | \`normal\`, \`bold\`, \`100\`–\`900\` |
| \`text_align\` | string | \`"left"\` | \`left\`, \`center\`, \`right\`, \`justify\` |
| \`text_decoration\` | string | \`"none"\` | \`none\`, \`underline\`, \`line-through\` |
| \`line_height\` | number | \`1.2\` | Line height (multiplier) |
| \`letter_spacing\` | number | \`0\` | Letter spacing (px) |
| \`cloze_mode\` | boolean | \`false\` | Cloze mode: \`%%\` become inline inputs |
| \`cloze_case_sensitive\` | boolean | \`true\` | Case sensitive in cloze correction |
| \`cloze_answer\` | string | \`""\` | Correct answer for cloze mode |

**Cloze mode**: Occurrences of \`%%\` in text are replaced by inline \`<input>\` elements. The participant types inside the inputs.

### ImageComponent

Static image. At runtime this is rendered through the shared Canvas path, with preloading and bitmap preparation when the browser supports it.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`stimulus\` | string | \`""\` | Image URL or path |
| \`width\` | number | \`auto\` | Width in vw% (0 = auto) |
| \`height\` | number | \`auto\` | Height in vw% (0 = auto) |
| \`maintain_aspect_ratio\` | boolean | \`true\` | Preserve aspect ratio when scaling |
| \`object_fit\` | string | \`"contain"\` | \`contain\`, \`cover\`, \`fill\`, \`none\` |

### AudioComponent

Audio with onset/duration control.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`stimulus\` | string | \`""\` | Audio file URL |
| \`show_controls\` | boolean | \`false\` | Show native browser controls |
| \`autoplay\` | boolean | \`true\` | Play automatically |
| \`loop\` | boolean | \`false\` | Repeat in loop |
| \`volume\` | number | \`1.0\` | Volume (0.0 to 1.0) |

### VideoComponent

Video with optional controls.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`stimulus\` | string | string[] | \`""\` | Video URL(s) (array for multiple sources) |
| \`width\` | number | \`auto\` | Width in vw% (0 = auto) |
| \`height\` | number | \`auto\` | Height in vw% (0 = auto) |
| \`autoplay\` | boolean | \`true\` | Play automatically |
| \`controls\` | boolean | \`false\` | Show controls |
| \`loop\` | boolean | \`false\` | Repeat in loop |
| \`muted\` | boolean | \`false\` | Muted |
| \`start_time\` | number | \`0\` | Playback start (seconds) |
| \`stop_time\` | number | \`null\` | Playback end (seconds, null = full) |
| \`playback_rate\` | number | \`1.0\` | Playback speed |

### HtmlComponent

Arbitrary HTML rendered in an isolated iframe.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`html\` | string | \`""\` | HTML content (including \`<style>\` and \`<script>\`) |
| \`width\` | number | \`auto\` | Width in vw% |
| \`height\` | number | \`auto\` | Height in vw% |

### SketchpadComponent

Free-drawing canvas for the participant.

| Parameter | Type | Default | Description |
|---|---|---|---|
| \`stroke_color\` | string | \`"#000000"\` | Stroke color |
| \`stroke_width\` | number | \`4\` | Stroke width (px) |
| \`background_color\` | string | \`"#ffffff"\` | Canvas background color |
`;
