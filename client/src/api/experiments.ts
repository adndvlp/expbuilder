import { db, initDb } from "./database/lowdb";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

// Detectar si estamos en Electron y exponer función para abrir HTML
const isElectron = typeof window !== "undefined" && window?.electronAPI;
async function openHtmlInBrowser(htmlPath: string) {
  if (isElectron && window.electronAPI?.invoke) {
    await window.electronAPI.invoke("open-html-in-browser", htmlPath);
  }
}

export interface Experiment {
  experimentID: string;
  name: string;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  storage?: string;
}

export async function getExperiments(): Promise<Experiment[]> {
  await initDb();
  return (db.data?.experiments || []).sort(
    (a: Experiment, b: Experiment) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getExperimentById(
  experimentID: string
): Promise<Experiment | undefined> {
  await initDb();
  return db.data?.experiments.find(
    (e: Experiment) => e.experimentID === experimentID
  );
}

export async function addExperiment({
  name,
  description,
  author,
  storage,
}: Omit<Experiment, "experimentID" | "createdAt" | "updatedAt"> & {
  storage?: string;
}): Promise<Experiment> {
  await initDb();
  const experiment: Experiment = {
    experimentID: uuidv4(),
    name,
    description,
    author,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    storage,
  };
  db.data!.experiments.push(experiment);
  await db.write();
  // Crear HTML inicial vacío (sin código generado)
  await runExperiment(experiment.experimentID, "");
  return experiment;
}

// Directorios de salida (ajustar según la estructura de tu app Electron)
const EXPERIMENTS_OUTPUT_DIR = path.resolve(
  __dirname,
  "../../experiments_html"
);
const PREVIEWS_OUTPUT_DIR = path.resolve(
  __dirname,
  "../../trials_previews_html"
);
// Directorio de plantillas (dentro del código fuente)
const TEMPLATES_DIR = path.resolve(__dirname, "./templates");

/**
 * Genera el HTML de un experimento a partir de un template e inserta el código generado.
 * Si recibe experimentID, busca el nombre en la DB. Si recibe experimentName, lo usa directo.
 * @param params experimentID o experimentName, y el código generado
 * @returns Ruta del archivo HTML generado
 */
export async function runExperiment(
  experimentID: string,
  generatedCode: string
): Promise<string> {
  await initDb();
  const experiment = db.data?.experiments.find(
    (e: Experiment) => e.experimentID === experimentID
  );
  if (!experiment || !experiment.name) {
    throw new Error("Experiment not found");
  }
  if (!generatedCode) {
    throw new Error("No generated code provided");
  }
  const templatePath = path.join(TEMPLATES_DIR, "experiment_template.html");
  const experimentHtmlPath = path.join(
    EXPERIMENTS_OUTPUT_DIR,
    `${experiment.name}-experiment.html`
  );
  if (!fs.existsSync(EXPERIMENTS_OUTPUT_DIR)) {
    fs.mkdirSync(EXPERIMENTS_OUTPUT_DIR, { recursive: true });
  }
  let html = fs.readFileSync(templatePath, "utf8");
  html = html.replace(/<script id="generated-script">[\s\S]*?<\/script>/, "");
  html = html.replace(
    "</body>",
    `<script id="generated-script">\n${generatedCode}\n<\/script>\n</body>`
  );
  fs.writeFileSync(experimentHtmlPath, html, "utf8");
  return experimentHtmlPath;
}

/**
 * Genera el HTML de preview de un experimento.
 * Si recibe experimentID, busca el nombre en la DB. Si recibe experimentName, lo usa directo.
 * @param params experimentID o experimentName, y el código generado
 * @returns Ruta del archivo HTML generado
 */

export async function runExperimentPreview(
  experimentID: string,
  generatedCode: string
): Promise<string> {
  await initDb();
  const experiment = db.data?.experiments.find(
    (e: Experiment) => e.experimentID === experimentID
  );
  if (!experiment || !experiment.name) {
    throw new Error("Experiment not found");
  }
  if (!generatedCode) {
    throw new Error("No generated code provided");
  }
  const templatePath = path.join(TEMPLATES_DIR, "trials_preview_template.html");
  const previewHtmlPath = path.join(
    PREVIEWS_OUTPUT_DIR,
    `${experiment.name}-preview.html`
  );
  if (!fs.existsSync(PREVIEWS_OUTPUT_DIR)) {
    fs.mkdirSync(PREVIEWS_OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(previewHtmlPath)) {
    fs.copyFileSync(templatePath, previewHtmlPath);
  }
  let html = fs.readFileSync(previewHtmlPath, "utf8");
  html = html.replace(/<script id="generated-script">[\s\S]*?<\/script>/, "");
  html = html.replace(
    "</body>",
    `<script id="generated-script">\n${generatedCode}\n<\/script>\n</body>`
  );
  fs.writeFileSync(previewHtmlPath, html, "utf8");
  return previewHtmlPath;
}

/**
 * Abre el HTML de un experimento localmente en el navegador por defecto (sin cloudflared).
 * @param htmlPath Ruta absoluta al archivo HTML del experimento
 * @returns { success: boolean, error?: string }
 */
export async function shareLocalExperimentHtml(
  htmlPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await openHtmlInBrowser(htmlPath);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteExperiment(experimentID: string): Promise<boolean> {
  await initDb();
  const idx = db.data!.experiments.findIndex(
    (e: Experiment) => e.experimentID === experimentID
  );
  if (idx !== -1) {
    db.data!.experiments.splice(idx, 1);
    await db.write();
    return true;
  }
  return false;
}
