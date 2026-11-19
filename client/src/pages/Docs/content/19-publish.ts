import type { DocSection } from "./types";

export const PublishSection: DocSection = {
  id: "publish",
  title: "Publishing to GitHub Pages",
  content: `# Publishing to GitHub Pages

## Flow

\`\`\`mermaid
flowchart TD
  A["Builder: Publish button"] --> B["generateExperiment(storage)"]
  B --> C["PublicConfiguration.ts generates public code"]
  C --> D["POST /api/publish-experiment/:id"]
  D --> E["Server: replace local bundles with CDN"]
  E --> F["Server: convert media files to base64"]
  F --> G["Server: push to the experiment's GitHub repo"]
  G --> H["GitHub Actions: deploy to GitHub Pages"]
  H --> I["https://user.github.io/repo-name/"]
\`\`\`

## Publishing Transformations

| Step | Description |
|---|---|
| 1. Generate public code | \`PublicConfiguration.generateExperiment(storage)\` — includes Firebase, IndexedDB, CAPTCHA |
| 2. Swap bundles | Replaces \`jspsych-bundle/index.js\` with individual scripts from unpkg CDN |
| 3. Only plugins used | Analyzes the trials and only includes the necessary \`<script>\` tags |
| 4. Transfer media | Base64 transports files to the publisher; the browser loads published \`img/\`, \`aud/\` and \`vid/\` files. |
| 5. Firebase config | Public web configuration and the active backend URL are included in the page. OAuth tokens remain on the backend. |
| 6. Push to GitHub | The current \`index.html\` and resources replace the experiment's publication; provider, destination and response validation are confirmed after upload. |
| 7. Automatic deploy | GitHub Actions (if configured) deploys to \`gh-pages\` |

## Public URL

\`\`\`text
https://[github-username].github.io/[repo-name]/
\`\`\`

The repo name is configured in **Builder → Settings → GitHub**.

## Which Changes Require Publishing?

After the experiment has been published with the current generator, use **Save Configuration** to apply IndexedDB, batch size, resume timeout, recruitment and CAPTCHA changes to **new sessions without republishing**. Existing sessions keep their original session configuration. Publishing does not undo those saved changes.

Session naming and appearance have their own save actions and require republication to update the public page. Trials, loops, code, media and the storage destination also require publication.

## Data Storage

Participant data in published experiments goes to:
- **Firestore** → session configuration, checkpoint, response payloads, receipts and export jobs
- **Firebase Realtime Database** → connection presence
- **Google Drive, Dropbox or OSF** → confirmed session results
- **Firebase Cloud Function** → file uploads (\`/uploadParticipantFile\`)
- **IndexedDB** (optional, in the participant's browser) → pending responses until their exact server acknowledgement, with no age-based expiry
`,
};
