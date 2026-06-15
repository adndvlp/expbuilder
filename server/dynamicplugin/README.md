# jsPsych ExpBuilder DynamicPlugin

DynamicPlugin is the composable jsPsych plugin used by ExpBuilder to render
multiple visual/audio components and response components inside one trial.

## Timing system

The current timing implementation uses:

- `performance.now()` and event timestamps for response timing;
- `requestAnimationFrame()` with nearest-frame scheduling for visual onset,
  stimulus duration, trial duration, and frame interval measurement;
- cached preload for current-trial assets;
- `ImageBitmap` preparation and WebGL textures for timing-critical
  `ImageComponent` and plain `TextComponent` stimuli;
- rAF-only visual commits during active trials;
- explicit DOM interactive-layer auditing for inputs, surveys, uploads, and
  cloze text;
- background prefetch for upcoming DynamicPlugin trial assets;
- optional critical RT from the measured visual trial onset;
- native capture-phase `keydown`/`pointerdown` response timing with event-lag
  diagnostics;
- per-trial and per-stimulus timing diagnostics, including duration error,
  dropped-frame estimates, render commit metrics, GPU timer metrics when
  available, and quality flags.
- `diagnostics_level` controls whether trials save summary-only data or full
  debug arrays.

For critical RT trials, enable `response_timing_enabled` and read `rt`/`rt_raw`
as:

```txt
response_time - response_anchor_time_abs
```

`rt_corrected` is saved separately only when a compatible calibration profile
is supplied; `rt` always remains the raw value.

Read the full timing documentation here:

- [TIMING.md](./TIMING.md)

## Build

```bash
npm run build
```

The build outputs:

- `dist/index.es.js`
- `dist/index.iife.js`
