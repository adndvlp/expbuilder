import type { DocSection } from "./types";

export const TroubleshootingSection: DocSection = {
  id: "troubleshooting",
  title: "Troubleshooting / FAQ",
  content: `# Troubleshooting / FAQ

## The experiment doesn't load

1. **Local**: Verify that the Express server is running (\`npm start\` in the root) and that port 3000 is available.
2. **Published**: Wait ~2 minutes after publishing for GitHub Pages to deploy. Check the repo's **Actions** tab.

## Files not showing (404)

- In **local** mode, files must have been uploaded from the Builder's Timeline panel. URLs are generated as \`/api/files/:id/filename.ext\`.
- In **published** mode, files are converted to base64 upon publishing. If a file fails, re-publish the experiment.

## Branching doesn't work

1. Verify that the **column names** in the conditions match the generated names exactly (case-sensitive).
2. For DynamicPlugin, the format is \`ComponentType_Index_Property\` (e.g. \`ButtonResponseComponent_1_response\`).
3. For SurveyComponent, access the nested property: \`SurveyComponent_1_response.questionName\`. The branching system handles this automatically if you select the question from the Builder's dropdown.
4. Check that the target trial **exists** in the timeline and is **after** the source trial (for branch, not jump).

## Resume doesn't work

1. Resume only works if the participant closes the browser **after** completing at least one trial with \`builder_id\`.
2. If the trial was deleted or renamed after the participant started, resume will fail (clean reset).
3. Clearing the browser's localStorage/cookies erases the resume state.
4. In incognito, resume does not persist between browser sessions.

## localStorage Limits

- localStorage has a limit of ~5-10 MB per domain.
- \`jsPsych_resumeTrial\` stores the complete \`data\` of the last trial. Heavy data (audio/video base64) may exceed the limit.
- **Solution**: Avoid storing large blobs. FileUploadResponseComponent and AudioResponseComponent upload files to the server and only store the URL.

## CORS Errors in Published Mode

- Firebase Cloud Functions must have CORS enabled for the GitHub Pages domain.
- \`DATA_API_URL\` is configured in Firestore. It must point to the correct Cloud Function URL.

## Browser Compatibility

| Browser | Status | Notes |
|---|---|---|
| Chrome 90+ | Supported | Full functionality |
| Firefox 90+ | Supported | WebGazer may have reduced accuracy |
| Edge 90+ | Supported | Chromium-based |
| Safari 15+ | Supported | AudioResponse may require explicit permission |
| Mobile Chrome | Partial | Responsive screen layouts required |
| Mobile Safari | Partial | Fullscreen not supported, AudioResponse limited |

## The Experiment is Slow

- **Published with IndexedDB**: Check \`BATCH_CONFIG\`. A \`size\` that's too low generates too many requests. Too high can cause data loss if the browser crashes.
- **Many files without preload**: Add a \`jsPsychPreload\` at the start or upload files from the Builder's Timeline.
- **Large SurveyJS**: Surveys with 50+ questions may take time to render. Consider splitting into multiple trials.

## Common Errors in Custom Code

1. **\`trial is not defined\`** in \`on_finish\`: The variable in \`on_finish\` is \`data\`, not \`trial\`.
2. **\`jsPsych is not defined\`** in inline code: Make sure the code is inside a callback, not in the global scope.
3. **Modifying \`window.nextTrialId\`** directly: Use the Builder's branch conditions. Manual modification can break the flow.
`,
};
