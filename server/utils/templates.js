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
  const sourcePath = path.join(sourceTemplatesDir, templateName);

  // Siempre copiar el template para asegurar que esté actualizado
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
  } else {
    console.error(`Source template not found: ${sourcePath}`);
    throw new Error(`Source template not found: ${templateName}`);
  }

  return targetPath;
}
