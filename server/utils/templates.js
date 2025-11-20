import fs from "fs";
import path from "path";
import { __dirname } from "./paths.js";
import { userDataRoot } from "./db.js";

export function ensureTemplate(templateName) {
  const templatesDir = path.join(userDataRoot, "templates");
  const sourceTemplatesDir = path.join(__dirname, "templates");

  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }

  const targetPath = path.join(templatesDir, templateName);

  if (!fs.existsSync(targetPath)) {
    const sourcePath = path.join(sourceTemplatesDir, templateName);
    if (fs.existsSync(sourcePath)) {
      console.log(
        `Copying template ${templateName} from ${sourcePath} to ${targetPath}`
      );
      fs.copyFileSync(sourcePath, targetPath);
    } else {
      console.error(`Source template not found: ${sourcePath}`);
      throw new Error(`Source template not found: ${templateName}`);
    }
  }

  return targetPath;
}
