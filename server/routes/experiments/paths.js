import fs from "fs";
import path from "path";
import { userDataRoot } from "../../utils/db.js";

export const experimentsHtmlDir = path.join(userDataRoot, "experiments_html");
export const trialsPreviewsHtmlDir = path.join(userDataRoot, "trials_previews_html");

/* istanbul ignore else -- directory creation fallback depends on first app startup. */
if (!fs.existsSync(experimentsHtmlDir)) {
  fs.mkdirSync(experimentsHtmlDir, { recursive: true });
}

/* istanbul ignore else -- directory creation fallback depends on first app startup. */
if (!fs.existsSync(trialsPreviewsHtmlDir)) {
  fs.mkdirSync(trialsPreviewsHtmlDir, { recursive: true });
}
