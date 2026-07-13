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
| 4. Media to base64 | Images, audio, video → \`data:...;base64,...\` inline in the HTML |
| 5. Firebase creds | Server credentials baked-in to the code |
| 6. Push to GitHub | The final HTML is committed to the experiment's repo |
| 7. Automatic deploy | GitHub Actions (if configured) deploys to \`gh-pages\` |

## Public URL

\`\`\`text
https://[github-username].github.io/[repo-name]/
\`\`\`

The repo name is configured in **Builder → Settings → GitHub**.

## Data Storage

Participant data in published experiments goes to:
- **Firebase Realtime Database** → sessions and trials
- **Firebase Cloud Function** → file uploads (\`/uploadParticipantFile\`)
- **IndexedDB** (local) → temporary buffer with 3-day TTL
`,
};
