# jsPsych ExpBuilder DynamicPlugin

DynamicPlugin is the composable jsPsych plugin used by ExpBuilder to render
multiple visual/audio components and response components inside one trial.

## Timing system

The current timing implementation uses:

- `performance.now()` and event timestamps for response timing;
- `requestAnimationFrame()` for visual onset, duration, trial duration, and
  frame interval measurement;
- cached preload for current-trial assets;
- `ImageBitmap` preparation, `CanvasImageComponent`, and `CanvasTextComponent`
  for timing-critical visual stimuli;
- background prefetch for upcoming DynamicPlugin trial assets;
- per-trial and per-stimulus timing diagnostics.

Read the full timing documentation here:

- [TIMING.md](./TIMING.md)

## Build

```bash
npm run build
```

The build outputs:

- `dist/index.es.js`
- `dist/index.iife.js`
