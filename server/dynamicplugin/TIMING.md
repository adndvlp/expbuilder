# DynamicPlugin timing implementation

This document describes the timing system implemented in `server/dynamicplugin`.
The goal is to provide browser timing controls and richer diagnostics for every
DynamicPlugin trial.

## Summary

The DynamicPlugin now follows this pipeline:

```txt
collect current-trial assets
preload current-trial images/audio/video with cache
prepare image bitmaps for canvas-rendered images when supported
build trial DOM while hidden
requestAnimationFrame()
mark trial onset from the frame timestamp
show the trial container
start response timing from that onset
measure each real frame interval
show/hide visual stimuli using measured frame elapsed time
end the trial using measured frame elapsed time
save desired-vs-actual timing diagnostics
prefetch upcoming DynamicPlugin trial assets in the background
```

This is browser-side timing control. It does not remove browser, OS, display,
keyboard, mouse, touch, or hardware polling limits.

## Main files

- `utils/PrecisionTiming.ts`
  Shared timing and preload utilities, including image bitmap caching.

- `renderer/CanvasStage.ts`
  Shared full-trial canvas stage with device-pixel-ratio scaling.

- `index.ts`
  DynamicPlugin orchestration, preload/prefetch, trial onset, trial duration,
  frame logging, timing quality classification, and result fields.

- `components/ImageComponent.ts`
- `components/TextComponent.ts`
  Canvas-based drawing for timing-critical images and plain text, with
  visual stimulus onset/duration scheduling via measured animation frames.

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

## Canvas rendering

The current runtime uses a shared `CanvasStage` for timing-critical visual
drawing. Use ordinary `ImageComponent` and `TextComponent`; separate
`CanvasImageComponent` and `CanvasTextComponent` files remain only for existing
saved configurations.

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

Canvas components use the same `PrecisionTiming` object as the DOM components:

```txt
scheduleAt(stimulus_onset) -> draw into canvas
scheduleAt(stimulus_onset + stimulus_duration) -> clear canvas
```

The onset and offset are still saved in `stimulus_timing`. The rendering change
is only the drawing path: the timing clock and diagnostics are unchanged.

Canvas rendering is appropriate for:

- fast image flashes;
- fixation images;
- short words or symbols;
- masks;
- simple priming stimuli;
- validation stimuli such as black/white squares.

Interactive components use a hybrid path when needed:

- `ButtonResponseComponent` draws standard button visuals into Canvas and keeps
  transparent native buttons on top for click, focus, keyboard, and
  accessibility behavior. Custom `button_html` uses the DOM path.
- `SliderResponseComponent` draws slider visuals into Canvas and keeps a
  transparent native range input on top for real browser interaction.
- `ClickResponseComponent` keeps a DOM capture layer but draws the optional
  response marker in Canvas.

Use DOM/native rendering for instructions, forms, surveys, arbitrary HTML,
text/file inputs, audio/video controls, and microphone/file workflows.

Canvas notes:

- A single full-trial canvas stage is shared by canvas-rendered visual
  components in the same trial.
- `clear_before_draw` defaults to `true`.
- `clear_on_offset` defaults to `true`.
- If `preload_assets` is disabled and the bitmap is not ready at onset, the
  component waits until the image is ready and draws on the next animation
  frame; the delayed actual onset is reflected in `stimulus_timing`.

## Result fields

These fields are added to trial data.

| Field | Type | Meaning |
| --- | --- | --- |
| `timing_method` | string | Always reports `performance.now + requestAnimationFrame`. |
| `trial_onset_time` | number | requestAnimationFrame timestamp used as trial onset. |
| `trial_offset_time` | number | timestamp used when the trial ended. |
| `actual_trial_duration` | number | observed duration from onset to offset, in ms. |
| `frame_count` | number | number of measured frame intervals. |
| `long_frame_count` | number | number of frame intervals above `frame_lag_threshold`. |
| `max_frame_interval` | number | largest measured frame interval, in ms. |
| `mean_frame_interval` | number | mean measured frame interval, in ms. |
| `frame_intervals` | JSON string | array of measured frame durations. |
| `stimulus_timing` | JSON string | desired-vs-actual timing records for visual stimuli. |
| `timing_quality` | string | `ok`, `warning`, or `bad`. |
| `timing_quality_reason` | string | human-readable reason when quality is not clean. |

### `stimulus_timing` schema

`stimulus_timing` is a JSON-encoded array. Each record has this shape:

```ts
{
  name: string;
  desired_onset: number;
  desired_duration: number | null;
  desired_offset: number | null;
  actual_onset: number | null;
  actual_offset: number | null;
  actual_duration: number | null;
  onset_error: number | null;
  duration_error: number | null;
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
- supports `scheduleAt(ms, callback)` for frame-based timers;
- supports `registerStimulus()` for desired-vs-actual stimulus timing;
- summarizes frame and stimulus timing at trial end.

The plugin does not assume a 60 Hz display or a fixed `16.667 ms` frame. If the
browser reports a `42 ms` frame, that interval is recorded as `42 ms`.

## How duration is controlled

The implementation does not compute a fixed number of frames in advance.
Instead, it cuts on the first frame where measured elapsed time reaches the
requested time:

```txt
if elapsed_from_onset >= requested_duration:
  hide stimulus or end trial
```

This is intentional because the real frame interval can vary across displays,
browser load, and device performance. Any overshoot is recorded in:

- `actual_trial_duration`
- `stimulus_timing[].actual_duration`
- `stimulus_timing[].duration_error`
- `frame_intervals`

## How RT is measured

Responses are anchored to the same trial onset.

For keyboard responses:

- `KeyboardResponseComponent` registers its keydown listener on the trial onset.
- It uses `event.timeStamp` when it is comparable to `performance.now()`.
- Otherwise it falls back to `performance.now()`.
- RT is `response_time - trial_onset`.

For other response components, RT is also measured against the same onset:

- buttons
- clicks/touches
- sliders
- inputs
- surveys
- file uploads
- sketchpad strokes
- audio-response button presses

This reduces the earlier problem where component RTs started during DOM render
instead of the first visible frame.

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

- `ok`: no long frames and no meaningful duration drift.
- `warning`: at least one long frame or minor timing drift.
- `bad`: frame interval, trial duration error, or stimulus duration error meets
  or exceeds `timing_quality_bad_threshold`.

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
    frame_count: d.frame_count,
    mean_frame_interval: d.mean_frame_interval,
    max_frame_interval: d.max_frame_interval,
    long_frame_count: d.long_frame_count,
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
actual_trial_duration: around 500-517 ms
mean_frame_interval: around 16.67 ms
long_frame_count: 0
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
