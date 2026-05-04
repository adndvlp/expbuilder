# Scaling & Coordinate System — Full Implementation Journey

## Part 1: Scaling of Standard jsPsych Plugins

### Problem
The RT task demo on jspsych.org scaled correctly when resizing the browser window, but the same experiment running locally did not.

### Root Cause
jsPsych's `prepareDom()` applies **inline styles** (`height: 100%`, `width: 100%`, `margin: 0`) only when the display element is `<body>`. When using a custom `<div id="jspsych-container">` as `display_element`, no inline styles are applied.

The local HTML was using:
```javascript
display_element: document.getElementById('jspsych-container')
```
with CSS:
```css
#jspsych-container { width: 100%; height: 100vh; }
```

CSS `height: 100vh` behaves differently than inline `height: 100%` in a flex layout chain. The body's flex layout could not properly shrink the container.

### Solution
Remove `display_element` from `initJsPsych()` in all code generators, letting jsPsych use `<body>` as default. `prepareDom()` then applies:
```js
document.querySelector("html").style.height = "100%"
body.style.margin = "0px"
body.style.height = "100%"
body.style.width = "100%"
```
This creates a proper flex chain: `html(100%) → body(100%) → content`. Flex-shrink (default `1`) on flex children makes content scale with the viewport.

### Prevention of Wrapper Stacking (jump-to-trial / resume)
Before each `initJsPsych()`, clean up stale wrappers:
```js
document.querySelectorAll('.jspsych-content-wrapper').forEach(el => el.remove());
```
This prevents stacking if `initJsPsych` is ever called multiple times without a page reload.

### Files changed
- `server/templates/experiment_template.html` — removed `#jspsych-container`, simplified
- `server/templates/trials_preview_template.html` — same
- `LocalConfiguration.ts` — removed `display_element`, added cleanup
- `PublicConfiguration.ts` — same
- `ExperimentPreview.tsx` — same

---

## Part 2: Scaling of Dynamic Plugin Components

### Problem
Dynamic plugin components did not scale with viewport resizing, unlike standard plugins.

### Root Cause
The dynamic plugin container used `position: fixed`:
```css
#jspsych-dynamic-plugin-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
}
```
`position: fixed` removes the element from the body's flex layout. Flex-shrink does not apply. Content with fixed pixel dimensions never scaled.

### Why Standard Plugins "Scale"
Standard plugins render directly into `#jspsych-content` which is a flex child of body. The canvas/image element has `flex-shrink: 1` (default). When the viewport shrinks:
1. Body shrinks (height: 100%)
2. Flex children shrink proportionally
3. Canvas CSS size shrinks, buffer content is stretched → visual scaling

This is a side effect of flex layout, not explicit code.

### Solution
Use `transform: scale()` with `ResizeObserver`, same mechanism as the ExperimentPreview iframe:

```css
#jspsych-dynamic-plugin-container {
  position: fixed;
  top: 50%;
  left: 50%;
  overflow: hidden;
}
```

```javascript
const canvasWidth = trial.__canvasStyles?.width ?? 1024;
const canvasHeight = trial.__canvasStyles?.height ?? 768;

const updateScale = () => {
  const ratio = Math.min(
    window.innerWidth / canvasWidth,
    window.innerHeight / canvasHeight,
    1
  );
  mainContainer.style.width = canvasWidth + "px";
  mainContainer.style.height = canvasHeight + "px";
  mainContainer.style.transform = "translate(-50%, -50%) scale(" + ratio + ")";
};

updateScale();
const resizeObserver = new ResizeObserver(() => updateScale());
resizeObserver.observe(document.documentElement);
```

The container renders at design canvas size (e.g., 1440×900) and is CSS-transformed to fit the viewport. `top: 50%; left: 50%` + `translate(-50%, -50%)` centers it. Cleanup: `resizeObserver.disconnect()` on trial end.

### Dynamic Plugin IIFE Fix
Rollup's IIFE library mode wrapped the default export as `{ default: DynamicPlugin, ... }`, but jsPsych expects the class directly. Added `exports: "default"` to `vite.config.ts` so the global `DynamicPlugin` variable is the class itself.

### Files changed
- `server/dynamicplugin/index.ts` — scale + resize + __canvasStyles injection + cleanup
- `server/dynamicplugin/vite.config.ts` — `exports: "default"`

---

## Part 3: Konva ↔ Runtime Coordinate Matching

### Problem
`trial.__canvasStyles` was always `undefined` at runtime, defaulting to 1024×768 regardless of what was configured in Konva.

### Root Cause Chain
1. `__canvasStyles` was **not declared** in `DynamicPlugin.info.parameters` in `index.ts`
2. The metadata generator (`extract-metadata-components.mjs`) did not include it in `plugin-dynamic.json`
3. `loadPluginParameters()` returned a `parameters` array without `__canvasStyles`
4. `activeParameters` filter in `useTrialCode.ts` excluded it
5. The generated trial code never included `__canvasStyles`
6. `trial.__canvasStyles` was `undefined` → default 1024×768

### Solution

#### A. Declare the parameter
Added to `DynamicPlugin.info.parameters`:
```typescript
__canvasStyles: {
  type: ParameterType.COMPLEX,
  default: { width: 1024, height: 768 },
},
```

#### B. Flow to generated code
Added `"__canvasStyles"` to `additionalDynamicParams` in `MappedJson.ts`:
```typescript
const additionalDynamicParams = [
  "trial_duration",
  "response_ends_trial",
  "require_response",
  "__canvasStyles",
];
```

#### C. Inject into component configs
Each component needs canvas dimensions for pixel calculations. Injected in the trial loop:
```typescript
config.__canvasStyles = trial.__canvasStyles;
```

#### D. Coordinate Math: vw/vh → Design-Canvas Pixels
Changed ImageComponent positioning from viewport-relative to design-canvas-relative:

**Before (broken with transform scale):**
```javascript
// vw/vh based — incompatible with container scaling
imageContainer.style.left = `calc(50% + ${xValue}vw)`;
imageContainer.style.top = `calc(50% - ${yValue}vh)`;
stimulusElement.style.width = `${config.width}vw`;
```

**After (same formula as Konva's `fromJsPsychCoords`):**
```javascript
// Design-canvas pixel coordinates
const canvasWidth = config.__canvasStyles?.width ?? 1024;
const canvasHeight = config.__canvasStyles?.height ?? 768;
const centerX = canvasWidth / 2;
const centerY = canvasHeight / 2;

const xPixel = centerX + (config.coordinates.x / 100) * (canvasWidth / 2);
const yPixel = centerY - (config.coordinates.y / 100) * (canvasHeight / 2);
imageContainer.style.left = xPixel + "px";
imageContainer.style.top = yPixel + "px";

// Design-canvas pixel dimensions
const pxW = (config.width / 100) * canvasWidth;
stimulusElement.style.width = pxW + "px";
```

The `transform: scale()` on the container handles all viewport sizing. Both Konva and runtime use identical coordinate math — single source of truth.

#### E. Regenerate metadata
```bash
node extract-metadata-components.mjs
```

### Files changed
- `server/dynamicplugin/index.ts` — parameter declaration + config injection
- `server/dynamicplugin/components/ImageComponent.ts` — pixel-based coordinates & sizing
- `MappedJson.ts` — __canvasStyles in additionalDynamicParams
- `server/dynamicplugin/extract-metadata-components.mjs` — (auto-regenerated)

---

## Summary of Coordinate System

| Context | Formula | Center |
|---------|---------|--------|
| **Konva (builder)** | `pixel = center + (coord/100) × (canvasSize/2)` | `(CANVAS_WIDTH/2, CANVAS_HEIGHT/2)` |
| **Runtime** | Same formula | `(__canvasStyles.width/2, __canvasStyles.height/2)` |
| **Coordinate range** | `[-100, 100]` | `(0, 0)` = center |
| **Width unit** | Number = % of canvas width | `30` = 30% of `__canvasStyles.width` px |

The container's `transform: scale(ratio)` where `ratio = min(vw/canvasW, vh/canvasH, 1)` ensures the design canvas fills the viewport proportionally on any screen.
