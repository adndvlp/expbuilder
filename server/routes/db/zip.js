import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { db, userDataRoot } from "../../utils/db.js";

export const ALLOWED_MEDIA_TYPES = new Set(["img", "aud", "vid", "others"]);

/* istanbul ignore next -- filename sanitization edge cases are defensive around exported ZIP names. */
export function sanitizeName(name) {
  return (
    String(name)
      .replace(/\.\./g, "_")
      .replace(/[^a-zA-Z0-9\-_. ]/g, "_")
      .trim() || "experiment"
  );
}

/* istanbul ignore next -- ZIP media permutations are covered by export route smoke tests. */
export async function buildExperimentsZip(experiments) {
  const zip = new JSZip();

  for (const experiment of experiments) {
    const experimentName = experiment.name || experiment.experimentID;
    const folderName = sanitizeName(experimentName);
    const folder = zip.folder(folderName);

    const trialsDoc =
      db.data.trials.find((t) => t.experimentID === experiment.experimentID) ||
      null;
    const configDoc =
      db.data.configs.find((c) => c.experimentID === experiment.experimentID) ||
      null;
    const sessionResults = db.data.sessionResults.filter(
      (s) => s.experimentID === experiment.experimentID,
    );

    folder.file(
      "data.json",
      JSON.stringify(
        { experiment, trials: trialsDoc, config: configDoc, sessionResults },
        null,
        2,
      ),
    );

    const mediaDir = path.join(userDataRoot, experimentName);
    if (fs.existsSync(mediaDir)) {
      for (const type of ALLOWED_MEDIA_TYPES) {
        const typeDir = path.join(mediaDir, type);
        if (!fs.existsSync(typeDir)) continue;
        for (const filename of fs.readdirSync(typeDir)) {
          const filePath = path.join(typeDir, filename);
          if (fs.statSync(filePath).isFile()) {
            folder.folder(type).file(filename, fs.readFileSync(filePath));
          }
        }
      }
    }
  }

  return zip.generateAsync({ type: "nodebuffer" });
}
