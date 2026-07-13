import type { DocSection } from "./types";

export const AnatomySection: DocSection = {
  id: "anatomy",
  title: "Anatomy of the Generated HTML",
  content: `# Anatomy of the Generated HTML

The generated experiment is a self-contained \`index.html\` file. It has 4 layers that execute in order:

\`\`\`mermaid
flowchart TD
  A["1. TEMPLATE HTML"] --> B["2. SESSION INITIALIZATION"]
  B --> C["3. initJsPsych()"]
  C --> D["4. TIMELINE"]
  D --> E["jsPsych.run(timeline)"]

  A1["&lt;head&gt;: jsPsych scripts + plugins"] -.- A
  A2["&lt;body&gt;: DOM overlays"] -.- A
  A3["&lt;script id='generated-script'&gt;"] -.- A

  B1["sessionId · participantNumber"] -.- B
  B2["Socket.IO / Firebase setup"] -.- B
  B3["loadingOverlay · resumeCode"] -.- B
  B4["CAPTCHA gate · Recruit platforms"] -.- B

  C1["on_data_update → persistence"] -.- C
  C2["on_finish → cleanup + redirect"] -.- C
  C3["extensions · custom code"] -.- C

  D1["preload trial → fullscreen trial"] -.- D
  D2["procedures (trials + conditional_functions)"] -.- D
  D3["loops (repetitions, nested)"] -.- D
\`\`\`

## Source Templates

| Template | Usage |
|---|---|
| \`experiment_template.html\` | Local bundle (Express/Electron) |
| \`experiment_template_unkpg.html\` | unpkg CDN (published to GitHub Pages) |
| \`trials_preview_template.html\` | Individual trial preview in Builder |

## Local vs Published Differences

| Aspect | Local (Express) | Published (GitHub Pages) |
|---|---|---|
| jsPsych bundle | \`/bundle/jspsych-bundle.js\` (local file) | unpkg CDN (only used plugins) |
| DynamicPlugin | \`../dynamicplugin/dist/index.iife.js\` | unpkg CDN |
| Socket.IO | Loaded from \`/socket.io/socket.io.js\` | Not included |
| Firebase SDK | Not included | Loaded dynamically from CDN |
| Persistence | PUT \`/api/append-result/:id\` | Firebase Realtime DB + IndexedDB |
| CAPTCHA | Not included | hCaptcha / reCAPTCHA |
| Recruitment | Not included | Prolific, MTurk |
| Media files | Served by Express | Base64 baked-in in the HTML |
`,
};
