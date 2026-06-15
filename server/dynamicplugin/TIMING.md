# DynamicPlugin timing implementation

This document describes the timing system implemented in `server/dynamicplugin`.
The goal is to provide browser timing controls and richer diagnostics for every
DynamicPlugin trial.

## Summary

The DynamicPlugin now follows this pipeline:

```txt
collect current-trial assets
preload current-trial images/audio/video with cache
prepare image bitmaps and WebGL textures for critical visual stimuli
build trial DOM while hidden
requestAnimationFrame()
mark trial onset from the frame timestamp
show the trial container
start response timing from that onset
measure each real frame interval
show/hide visual stimuli on the frame closest to their target time
commit WebGL/Canvas stages inside the same animation frame
end the trial on the frame closest to the requested duration
save desired-vs-actual timing diagnostics
prefetch upcoming DynamicPlugin trial assets in the background
```

This is browser-side timing control. It does not remove browser, OS, display,
keyboard, mouse, touch, or hardware polling limits.

## Main files

- `utils/PrecisionTiming.ts`
  TimingEngine and preload utilities, including nearest-frame scheduling,
  frame diagnostics, legacy response RT helpers, and image bitmap caching.

- `utils/ResponseTimingManager.ts`
  Critical response timing manager. It installs native capture-phase keyboard
  and pointer listeners, anchors RT to the committed onset of an explicit visual
  stimulus, normalizes event timestamps, records event-loop lag, and exports
  response quality/calibration diagnostics.

- `renderer/CanvasStage.ts`
  Shared stage abstraction. Timing-critical images/text use WebGL retained
  sprites and GPU textures by default; Canvas 2D remains for fallback and
  non-critical overlays.

- `index.ts`
  DynamicPlugin orchestration, preload/prefetch, trial onset, trial duration,
  frame logging, timing quality classification, and result fields.

- `components/ImageComponent.ts`
- `components/TextComponent.ts`
  WebGL sprite/texture rendering for timing-critical images and plain text,
  with onset/offset confirmed by the renderer commit for that animation frame.

- `components/CanvasImageComponent.ts`
- `components/CanvasTextComponent.ts`
  Legacy compatibility components kept for existing saved configurations.

- `components/HtmlComponent.ts`
  DOM/iframe rendering for arbitrary HTML with animation-frame onset/duration
  scheduling.

- `response_components/KeyboardResponseComponent.ts`
  Keyboard RT measured against the actual trial onset.

- `response_components/ClickResponseComponent.ts`
- `response_components/SliderResponseComponent.ts`
- `response_components/ButtonResponseComponent.ts`
  Canvas-rendered visuals with DOM overlays retained for real browser
  interaction.

- `response_components/InputResponseComponent.ts`
- `response_components/SurveyComponent.ts`
- `response_components/FileUploadResponseComponent.ts`
- `components/SketchpadComponent.ts`
- `response_components/AudioResponseComponent.ts`
  Response/stroke/recording RTs anchored to the same trial onset.

- `components/AudioComponent.ts`
- `components/VideoComponent.ts`
  Autoplay is aligned to the first measured frame when the DynamicPlugin timing
  object is available.

## Trial parameters

These parameters were added to `DynamicPlugin.info.parameters`.

| Parameter | Default | Meaning |
| --- | ---: | --- |
| `preload_assets` | `true` | Preload assets used by the current DynamicPlugin trial before the first visible frame. |
| `asset_preload_timeout` | `10000` | Max time, in ms, to wait for each asset preload before continuing. |
| `record_frame_timing` | `true` | Save measured requestAnimationFrame intervals for lag diagnostics. |
| `frame_lag_threshold` | `34` | Frame interval, in ms, counted as a long/lagged frame. |
| `prefetch_next_trials` | `true` | Prefetch assets from upcoming DynamicPlugin trials in the background. |
| `prefetch_trial_count` | `3` | Number of upcoming DynamicPlugin trials to inspect for background prefetch. |
| `timing_quality_bad_threshold` | `50` | Absolute timing error, in ms, that marks timing quality as `bad`. |
| `render_backend` | `"webgl-strict"` | Renderer requested for timing-critical visual components. |
| `record_render_timing` | `true` | Save CPU-side render commit diagnostics. |
| `diagnostics_level` | `"debug"` | Controls diagnostic arrays: `summary`, `stimulus`, `frame`, or `debug`. |
| `record_gpu_timing` | `true` | Use WebGL disjoint timer queries when available. |
| `response_timing_enabled` | `false` | Enable critical response timing from the committed visual onset of an explicit anchor stimulus. |
| `response_required` | `false` | If enabled, no valid response before trial end is saved as timeout/bad. If false, no response is allowed without marking timeout bad. |
| `response_anchor_component_id` | `null` | Stable component ID for the stimulus whose committed visual onset anchors RT. Preferred over name. |
| `response_anchor_component` | `null` | Human-readable anchor stimulus name, used as fallback when no ID is supplied. |
| `response_allowed_from` | `"anchor_onset"` | Earliest valid response anchor. Use `"anchor_onset"`, `"trial_onset"`, or `{ "from": "anchor_onset" | "trial_onset", "at_ms": number }`. |
| `premature_response_policy` | `"end_invalid"` | What to do with responses before `response_allowed_from`: `"end_invalid"` or `"ignore"`. |
| `response_timing_quality_mode` | `"normal"` | Event-lag thresholds: `"normal"` uses >8 ms warning and >16.7 ms bad; `"strict"` uses >4 ms warning and >8 ms bad. |
| `minimum_valid_rt_ms` | `null` | Optional lower RT bound. Responses below this are invalid. |
| `response_calibration_profile` | `null` | Optional benchmark-derived bias profile. Bias correction is applied only on a matched browser/OS/input/display profile. |
| `response_expected_delay_ms` | `null` | External benchmark expected delay, used to compute `response_error_ms`. |
| `external_reference_id` | `null` | ID for the external benchmark run/device/reference. |

Existing parameters still work:

- `trial_duration` is now scheduled on measured animation frames.
- `response_ends_trial` still ends the trial on response when enabled.
- `require_response` still blocks participant-triggered trial end until required
  response components are valid.

Visual component timing parameters are also frame-scheduled:

- `stimulus_onset`
- `stimulus_duration`

This currently applies to `HtmlComponent`, `ImageComponent`, `TextComponent`,
and the legacy `CanvasImageComponent` / `CanvasTextComponent`.

## WebGL rendering

The current runtime uses a WebGL stage for timing-critical visual drawing.
Use ordinary `ImageComponent` and `TextComponent`; separate
`CanvasImageComponent` and `CanvasTextComponent` files remain only for existing
saved configurations.

Critical image flow:

```txt
image file
-> decode/ImageBitmap
-> gl.createTexture()/gl.texImage2D() before the trial clock starts
-> retained sprite
-> requestAnimationFrame scheduler changes sprite visibility
-> WebGL commit confirms onset/offset
```

Plain critical text is prerendered once to an offscreen canvas, uploaded as a
WebGL texture before trial onset, and then displayed as a sprite. Cloze/input
text remains DOM-based because it is interactive.

Image example:

```js
{
  type: DynamicPlugin,
  components: [
    {
      type: "ImageComponent",
      name: "critical_image",
      stimulus: "armadillo.png",
      coordinates: { x: 0, y: 0 },
      width: 40,
      stimulus_onset: 0,
      stimulus_duration: 100
    }
  ],
  response_ends_trial: false,
  trial_duration: 350,
  record_frame_timing: true
}
```

Short text example:

```js
{
  type: DynamicPlugin,
  components: [
    {
      type: "TextComponent",
      name: "critical_word",
      text: "RED",
      font_size: 64,
      font_color: "#ff0000",
      coordinates: { x: 0, y: 0 },
      stimulus_onset: 0,
      stimulus_duration: 100
    }
  ],
  response_ends_trial: false,
  trial_duration: 350,
  record_frame_timing: true
}
```

Critical visual components use the same `PrecisionTiming` object as the DOM
components:

```txt
scheduleAt(stimulus_onset) -> mark sprite visible
frame commit -> confirm onset
scheduleAt(stimulus_onset + stimulus_duration) -> mark sprite hidden
frame commit -> confirm offset
```

`scheduleAt()` targets the closest animation frame, not merely the first frame
after the requested timestamp.

The onset and offset are saved in `stimulus_timing` only after the sprite is
included in the frame commit. This keeps timing records tied to the visual
renderer, not merely to the request to show/hide a stimulus.

WebGL critical rendering is appropriate for:

- fast image flashes;
- fixation images;
- short words or symbols;
- masks;
- simple priming stimuli;
- validation stimuli such as black/white squares.

Interactive components use a hybrid path when needed:

- `ButtonResponseComponent` uses a WebGL retained texture plus canvas-coordinate
  hitboxes when `response_timing_enabled` is true and the button is a standard
  text button. Custom `button_html`, image buttons, and non-critical response
  timing use the DOM interactive path.
- `SliderResponseComponent` draws slider visuals into Canvas and keeps a
  transparent native range input on top for real browser interaction.
- `ClickResponseComponent` keeps a DOM capture layer but draws the optional
  response marker in Canvas.

Use DOM/native rendering for instructions, forms, surveys, arbitrary HTML,
text/file inputs, audio/video controls, and microphone/file workflows.

Renderer notes:

- Critical sprites in the same trial share a WebGL stage.
- During an active trial, `stage.render()` only marks the stage dirty. The
  visible commit happens only from the TimingEngine's `onFrameCommit(timestamp)`
  callback.
- `visual_all_commits_rAF` is `false` if any visual stage commits outside that
  rAF path while the trial clock is active.
- Legacy `draw(ctx)` drawables are compatibility-only. If they are converted to
  a temporary canvas/texture during an active trial, the trial is marked `bad`.
- Texture uploads during the trial are counted and mark timing quality as
  `bad`.
- Shader compile/link operations during the trial are counted and mark timing
  quality as `bad`.
- WebGL context loss marks timing quality as `bad`.
- `clear_before_draw` defaults to `true`.
- `clear_on_offset` defaults to `true`.
- If `preload_assets` is disabled and the bitmap is not ready at onset, the
  component waits until the image is ready and uploads the texture later; the
  delayed actual onset and `texture_uploads_during_trial` are reflected in the
  saved data.

DOM is still used for the interactive layer:

```txt
InteractiveLayer:
  inputs, surveys, file uploads, cloze text, native sliders, focus handling

VisualRenderer:
  timing-measured visual stimuli via WebGL retained sprites
```

`dom_interactive_components` is allowed. `dom_visual_components` records visual
stimuli that used the DOM path instead of the VisualRenderer, so strict visual
timing runs should keep it at `0`.

Diagnostic payload levels:

| Level | Saved arrays |
| --- | --- |
| `summary` | no heavy arrays; summary metrics only. |
| `stimulus` | `stimulus_timing`. |
| `frame` | `stimulus_timing`, `frame_intervals`. |
| `debug` | `stimulus_timing`, `frame_intervals`, plus `commit_durations` and `gpu_draw_durations` when render/GPU timing are enabled. |

`record_render_timing: false` suppresses render time-series arrays even at
`debug` level. Summary render fields such as `commit_count`,
`mean_commit_duration`, and `max_commit_duration` are still saved.

## Result fields

These fields are added to trial data.

| Field | Type | Meaning |
| --- | --- | --- |
| `timing_method` | string | Always reports `performance.now + requestAnimationFrame`. |
| `trial_onset_time` | number | requestAnimationFrame timestamp used as trial onset. |
| `trial_offset_time` | number | timestamp used when the trial ended. |
| `actual_trial_duration` | number | observed duration from onset to offset, in ms. |
| `duration_error` | number | `actual_trial_duration - trial_duration`, or `null` when no duration was requested. |
| `trial_ended_by_response` | boolean | true when the trial ended because a participant response was accepted or invalidated. In that case `duration_error` is still saved but ignored for visual timing quality. |
| `frame_count` | number | number of measured frame intervals. |
| `long_frame_count` | number | number of frame intervals above `frame_lag_threshold`. |
| `dropped_frame_count` | number | estimated missed frames from intervals longer than the measured baseline frame. |
| `max_frame_interval` | number | largest measured frame interval, in ms. |
| `mean_frame_interval` | number | mean measured frame interval, in ms. |
| `frame_interval_estimate` | number | median measured frame interval used as the baseline frame duration. |
| `frame_intervals` | JSON string | array of measured frame durations; saved at `frame` and `debug` levels. |
| `stimulus_timing` | JSON string | desired-vs-actual timing records for visual stimuli; saved at `stimulus`, `frame`, and `debug` levels. |
| `timing_quality` | string | `ok`, `warning`, or `bad`. |
| `timing_quality_reason` | string | human-readable reason when quality is not clean. |
| `visual_timing_quality` | string | visual/render timing quality before response timing is merged. |
| `response_timing_quality` | string | critical response timing quality. |
| `response_timing_quality_reason` | string | response timing quality reasons such as timestamp fallback, event lag, timeout, hidden/blur, or missing anchor. |
| `diagnostics_level` | string | normalized diagnostic payload level used for this trial. |
| `render_backend_requested` | string | requested renderer backend, usually `webgl-strict`. |
| `render_backend` | string | actual renderer backend(s) used. |
| `visual_backend` | string | visual renderer backend alias for audit exports. |
| `visual_all_commits_rAF` | boolean | false if any visual commit happened outside the rAF commit callback while the trial was active. |
| `commit_outside_raf_count` | number | number of visual commits outside the rAF commit callback during the active trial. Should be `0`. |
| `render_backend_fallback` | boolean | true when WebGL was requested but Canvas fallback was used. |
| `render_backend_error` | string | renderer initialization error when fallback was needed. |
| `buffer_strategy` | string | renderer strategy, e.g. `webgl-retained-sprites`. |
| `commit_count` | number | number of renderer commits. |
| `commit_durations` | JSON string | CPU-side renderer commit durations in ms; saved only at `debug` level when `record_render_timing` is enabled. |
| `mean_commit_duration` | number | mean CPU-side renderer commit duration. |
| `max_commit_duration` | number | max CPU-side renderer commit duration. |
| `draw_call_count` | number | total draw calls issued by stages. |
| `texture_uploads_during_trial` | number | WebGL texture uploads after the trial clock started. Should be `0` for reliable critical trials. |
| `legacy_drawables_during_trial` | number | legacy `draw(ctx)` drawables rendered during the active trial. Should be `0`. |
| `legacy_texture_uploads_during_trial` | number | temporary legacy canvas-to-texture uploads during the active trial. Should be `0`. |
| `buffer_uploads_during_trial` | number | WebGL buffer uploads after the trial clock started. Should be `0` for reliable critical trials. |
| `shader_compiles_during_trial` | number | shader compile/link operations after the trial clock started. Should be `0`. |
| `webgl_context_lost_count` | number | WebGL context loss events during the trial. |
| `gpu_timer_available` | boolean | whether GPU timing queries were available. |
| `gpu_draw_durations` | JSON string | GPU draw durations in ms when valid timer queries are available; saved only at `debug` level when render/GPU timing are enabled. |
| `mean_gpu_draw_duration` | number | mean valid GPU draw duration. |
| `max_gpu_draw_duration` | number | max valid GPU draw duration. |
| `gpu_pending_query_count` | number | GPU timer queries that were not ready when the trial data was finalized. |
| `gpu_disjoint_count` | number | invalid/disjoint GPU timing events. |
| `dom_interactive_components` | JSON string | DOM components intentionally kept in the interactive layer. |
| `dom_visual_components` | number | visual stimulus components rendered via DOM instead of the VisualRenderer. Strict timing runs should report `0`. |
| `dom_visual_component_names` | JSON string | names/types of DOM visual components found in the trial. |
| `rt` | number | Raw critical RT alias when `response_timing_enabled` is true; otherwise legacy first component RT. Never stores corrected RT. |
| `rt_raw` | number | `response_time - stimulus_actual_onset_abs`, in decimal ms. |
| `rt_corrected` | number | Bias-corrected RT only when a calibration profile fully matches; otherwise `null`. |
| `response_timing_enabled` | boolean | Whether critical response timing was active. |
| `response_required` | boolean | Whether a missing response should become timeout/bad. |
| `response_anchor_component_id` | string | Stable anchor component ID used for lookup. |
| `response_anchor_component` | string | Anchor component name used for lookup fallback. |
| `response_start_anchor` | string | Anchor source, currently `stimulus_onset_commit` when resolved. |
| `stimulus_actual_onset_abs` | number | Absolute rAF timestamp of the anchor stimulus commit. |
| `response_allowed_from` | string | Serialized allowed-from policy. |
| `response_allowed_from_abs` | number | Resolved absolute timestamp after applying the allowed-from policy. |
| `premature_response_policy` | string | `end_invalid` or `ignore`. |
| `minimum_valid_rt_ms` | number | Lower RT bound used for the trial. |
| `response_before_anchor` | boolean | True when a response was invalidated before the allowed anchor. |
| `response_before_anchor_time` | number | Absolute response timestamp for the premature response. |
| `response_timeout` | boolean | True when a required response was missing by trial end. |
| `response_timeout_ms` | number | Time from `response_allowed_from_abs` to trial offset when timeout occurred. |
| `response_time` | number | Normalized response timestamp. |
| `response_now_at_handler` | number | `performance.now()` when the event handler ran. |
| `response_timestamp_source` | string | `event.timeStamp` or `performance.now_fallback`. |
| `response_event_lag` | number | `response_now_at_handler - response_time`; high values indicate event-loop delay. |
| `response_bias_correction_ms` | number | Calibration bias subtracted from `rt_raw` when profile match is `matched`. |
| `response_calibration_profile_id` | string | Calibration profile ID. |
| `response_calibration_match_status` | string | `matched`, `partial`, `mismatch`, or `none`. |
| `response_event_type` | string | Native event type, e.g. `keydown` or `pointerdown`. |
| `response_device` | string | `keyboard`, `mouse`, `touch`, `pen`, or browser pointer type. |
| `response_key` | string | Keyboard `event.key`. |
| `response_code` | string | Keyboard `event.code`. |
| `response_repeat` | boolean | Keyboard repeat flag. Repeats are ignored. |
| `response_is_trusted` | boolean | Native event `isTrusted`. |
| `response_valid` | boolean/null | `true` valid response, `false` invalid response, `null` no response when not required. |
| `response_invalid_reason` | string | Closed reason such as `missing_anchor`, `before_anchor`, `timeout`, or `below_minimum_rt`. Premature responses before an anchor commit are reported as `before_anchor`; `response_timing_quality_reason` may also include `anchor_without_onset_commit` as detail. |
| `response_client_x` / `response_client_y` | number | Raw viewport coordinates for pointer responses. |
| `response_canvas_x` / `response_canvas_y` | number | Pointer coordinates normalized into the Dynamic canvas coordinate space. |
| `device_pixel_ratio` | number | Browser `window.devicePixelRatio`. |
| `canvas_bounding_rect` | JSON string | Canvas/container rect used for pointer coordinate normalization. |
| `response_target_component` | string | Button/click target component or label. |
| `document_hidden_during_trial` | boolean | True if the document became hidden while the response manager was active. |
| `window_blur_during_trial` | boolean | True if the window blurred while the response manager was active. |
| `response_expected_delay_ms` | number | Benchmark expected delay. |
| `external_reference_id` | string | Benchmark external reference ID. |
| `response_error_ms` | number | `rt_raw - response_expected_delay_ms` when expected delay is provided. |
| `response_listener_attached` | boolean | True after native listeners were installed. |
| `response_listener_removed` | boolean | True after native listeners were aborted/removed. |

### `stimulus_timing` schema

`stimulus_timing` is a JSON-encoded array. Each record has this shape:

```ts
{
  component_id: string | null;
  name: string;
  desired_onset: number;
  desired_duration: number | null;
  desired_offset: number | null;
  actual_onset: number | null;
  actual_onset_abs: number | null;
  actual_offset: number | null;
  actual_offset_abs: number | null;
  actual_duration: number | null;
  onset_error: number | null;
  offset_error: number | null;
  duration_error: number | null;
  onset_commit_index: number | null;
  offset_commit_index: number | null;
  onset_commit_duration: number | null;
  offset_commit_duration: number | null;
  render_backend: string | null;
}
```

Example:

```js
const rows = jsPsych.data.get().values();
const timing = JSON.parse(rows[0].stimulus_timing);
console.table(timing);
```

## How frame timing works

`createPrecisionTiming()` in `utils/PrecisionTiming.ts` owns the timing state.

It:

- starts on the first `requestAnimationFrame()` callback;
- stores that frame timestamp as `onsetTime`;
- measures every following frame interval as `timestamp - lastFrameTime`;
- ignores zero/sub-millisecond pseudo-intervals so `frame_intervals` only
  contains real frame gaps;
- supports `scheduleAt(ms, callback)` for nearest-frame timers;
- supports `registerStimulus()` for desired-vs-actual stimulus timing;
- supports frame commit callbacks so renderer commits happen inside the same
  animation frame after show/hide events;
- summarizes frame and stimulus timing at trial end.

The plugin does not assume a 60 Hz display or a fixed `16.667 ms` frame. If the
browser reports a `42 ms` frame, that interval is recorded as `42 ms`.

## How duration is controlled

The implementation does not use `setTimeout()` for critical visual timing.
It estimates the current frame interval from recent animation frames and cuts
on the frame whose timestamp is closest to the requested target:

```txt
targetTime = trial_onset + requested_duration

errorNow = abs(current_frame_timestamp - targetTime)
errorNext = abs(current_frame_timestamp + frameMs - targetTime)

if errorNow <= errorNext:
  hide stimulus or end trial on this frame
```

This lets a requested duration land slightly before or after the nominal
millisecond target when that frame is closer. Any error is recorded in:

- `actual_trial_duration`
- `duration_error`
- `stimulus_timing[].actual_duration`
- `stimulus_timing[].offset_error`
- `stimulus_timing[].duration_error`
- `frame_intervals`

## Critical RT measurement

When `response_timing_enabled` is `true`, DynamicPlugin uses
`ResponseTimingManager` instead of component-local browser click/keydown timing
for keyboard, click, and standard button responses.

The critical RT equation is:

```txt
rt = rt_raw = response_time - stimulus_actual_onset_abs
```

`stimulus_actual_onset_abs` is the rAF timestamp from the renderer commit where
the anchor stimulus became visible. This is stricter than measuring from a
logical trial start or component render time.

Critical response timing uses:

- native `keydown` and `pointerdown` listeners on `window`;
- capture phase, so the event is observed before component bubble handlers;
- `event.timeStamp` when it shares the `performance.now()` time origin;
- `performance.now()` fallback only when the event timestamp is not comparable;
- `response_event_lag = performance.now() - event.timeStamp`;
- `pointerdown`, not `click`, for pointer RT;
- hit testing for button/click targets;
- optional calibration bias saved separately as `rt_corrected`.

Example:

```js
{
  type: DynamicPlugin,
  response_timing_enabled: true,
  response_required: true,
  response_anchor_component_id: "prime_image_01",
  response_allowed_from: "anchor_onset",
  minimum_valid_rt_ms: 100,
  components: [
    {
      type: "ImageComponent",
      component_id: "prime_image_01",
      name: "prime",
      stimulus: "prime.png",
      stimulus_onset: 0,
      stimulus_duration: 100
    }
  ],
  response_components: [
    {
      type: "KeyboardResponseComponent",
      choices: ["f", "j"]
    }
  ],
  trial_duration: 1500
}
```

If `response_timing_enabled` is false, legacy response components still report
their component RTs. The plugin-level `rt` remains the first recorded legacy RT.

`rt_corrected` is never copied into `rt`. It is only saved when a calibration
profile matches the current browser family, browser major version, OS family,
input device, and display refresh estimate closely enough. Partial or mismatch
profiles are reported but not applied.

## Preload and prefetch

### Current-trial preload

Before the first visible frame, `DynamicPlugin` collects assets from the current
trial and preloads them.

Current-trial asset discovery includes:

- `ImageComponent.stimulus`
- `CanvasImageComponent.stimulus` for legacy saved configs
- `AudioComponent.stimulus`
- `VideoComponent.stimulus`
- `SketchpadComponent.background_image`
- image URLs used as `ButtonResponseComponent.choices`

Image preload uses `Image()` plus `decode()` when available. It also prepares
an `ImageBitmap` cache when `createImageBitmap()` is available, with a decoded
`HTMLImageElement` fallback for image types that cannot be converted to a
bitmap.
Audio/video preload uses jsPsych's `pluginAPI.preloadAudio()` and
`pluginAPI.preloadVideo()`.

### Global cache

`PrecisionTiming.ts` keeps module-level caches:

- `imagePreloadCache`
- `bitmapPreloadCache`
- `audioPreloadCache`
- `videoPreloadCache`

The same URL is not preloaded repeatedly by DynamicPlugin.

### Upcoming-trial prefetch

After the current trial starts, DynamicPlugin tries to inspect jsPsych's current
timeline description and prefetch assets from the next `prefetch_trial_count`
DynamicPlugin trials.

This is best-effort. It may not discover every future asset when future trials
are produced dynamically by functions, conditional timelines, loop logic, or
runtime timeline variables that are not visible in the root timeline
description.

## Timing quality

`timing_quality` is computed at trial end.

Values:

- `ok`: no long/dropped frames and timing errors stay within half of the
  measured frame interval.
- `warning`: at least one long/dropped frame or a timing error above half a
  frame.
- `warning`: also assigned when a visual stimulus uses the DOM path instead of
  the VisualRenderer.
- `bad`: frame interval, trial duration error, or stimulus duration error meets
  or exceeds `timing_quality_bad_threshold`.
- `duration_error` is not used for visual quality when
  `trial_ended_by_response` is `true`; response-terminated RT trials are
  expected to end before the nominal `trial_duration`.
- `bad`: also assigned when WebGL falls back unexpectedly, uploads textures
  or buffers during a trial, compiles shaders during a trial, loses context,
  uses a legacy drawable during a trial, uploads a legacy texture during a
  trial, or commits visual output outside the rAF commit callback.

The reason is stored in `timing_quality_reason`, for example:

```txt
2 long frame(s); max frame 71.4ms
```

## Verification snippets

Basic timing table:

```js
console.table(
  jsPsych.data.get().values().map((d) => ({
    rt: d.rt,
    actual_trial_duration: d.actual_trial_duration,
    duration_error: d.duration_error,
    frame_count: d.frame_count,
    frame_interval_estimate: d.frame_interval_estimate,
    mean_frame_interval: d.mean_frame_interval,
    max_frame_interval: d.max_frame_interval,
    long_frame_count: d.long_frame_count,
    dropped_frame_count: d.dropped_frame_count,
    timing_quality: d.timing_quality,
    timing_quality_reason: d.timing_quality_reason,
  })),
);
```

Stimulus timing table for the latest trial:

```js
const latest = jsPsych.data.get().last(1).values()[0];
console.table(JSON.parse(latest.stimulus_timing || "[]"));
```

Frame interval inspection:

```js
const latest = jsPsych.data.get().last(1).values()[0];
const intervals = JSON.parse(latest.frame_intervals || "[]");
console.log({
  frames: intervals.length,
  max: Math.max(...intervals),
  over34: intervals.filter((x) => x > 34).length,
});
```

## Expected values

On a stable 60 Hz display, a 500 ms trial often looks like:

```txt
actual_trial_duration: around 500 ms, plus/minus about half a frame
duration_error: usually within about +/-8.3 ms
mean_frame_interval: around 16.67 ms
long_frame_count: 0
dropped_frame_count: 0
timing_quality: ok
```

On a lagged trial:

```txt
max_frame_interval: 50+ ms
long_frame_count: > 0
timing_quality: warning or bad
```

## Limits

The browser still cannot fully control or observe:

- physical pixel onset measured by a photodiode;
- display scanout behavior;
- keyboard polling rate;
- mouse/touch hardware sampling rate;
- OS/browser event queue delays;
- background-tab throttling;
- CPU/GPU contention;
- participants' hardware and drivers.

For physical timing validation, use external hardware:

```txt
photodiode on screen
instrumented key/button
microcontroller or oscilloscope
compare physical onset/response against saved trial data
```

## Build verification

After changes:

```bash
cd server/dynamicplugin
npm run build
```

The build regenerates:

- `dist/index.es.js`
- `dist/index.iife.js`
