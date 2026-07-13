import type { DocSection } from "./types";

export const OverlaysSection: DocSection = {
  id: "overlays",
  title: "Overlays (Loading / Success)",
  content: `# Overlays

The generated experiment includes a DOM overlay system (not canvas) for visual communication with the participant.

## Overlay API

| Function | Purpose |
|---|---|
| \`_showLoading(msg)\` | Full-screen overlay with spinner + message. Blocks interaction. |
| \`_setLoadingMsg(msg)\` | Updates the text without re-creating the DOM. |
| \`_hideLoading()\` | Removes the overlay immediately. |
| \`_showSuccess()\` | Animated green checkmark + "Experiment complete. Thank you!" |

## Behavior

- The overlay is created as a fixed \`<div>\` covering the entire viewport, with maximum \`z-index\`.
- The overlay background color and success message match the **Canvas Styles** configured in the Trial Designer.
- The spinner is a pure CSS animation (no external libraries).
- The success checkmark is an inline SVG with \`stroke-dasharray\` animation.

## Typical Sequence in on_finish

\`\`\`js
on_finish: async function() {
// 1. Show loading while saving data
_showLoading('Saving your data…');
await new Promise(r => setTimeout(r, 0)); // yield to event loop

// 2. Flush pending data
await Promise.all(pendingDataSaves);

// 3. Update message
_setLoadingMsg('Finishing up…');

// 4. Complete session
await fetch("/api/complete-session/" + experimentID, { method: "POST" });

// 5. Show success
_showSuccess();
}
\`\`\`

## Availability in Custom Code

All overlay functions are available in the global scope. They can be used in:

- \`on_start\` / \`on_finish\` of any trial
- Global Custom Code
- Custom initJsPsych override

\`\`\`js
// Example: show loading while loading a heavy resource
on_start: function(trial) {
_showLoading('Loading stimuli…');
// preload something...
_hideLoading();
}
\`\`\`
`,
};
