import fs from "fs";
import path from "path";

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
 * @param experimentName Nombre del experimento (usado para el archivo)
 * @param generatedCode Código JS generado a insertar en el template
 * @returns Ruta del archivo HTML generado
 */
export async function runExperiment(
  experimentName: string,
  generatedCode: string
): Promise<string> {
  // Usar la nueva ubicación de plantillas y salida
  const templatePath = path.join(TEMPLATES_DIR, "experiment_template.html");
  const experimentHtmlPath = path.join(
    EXPERIMENTS_OUTPUT_DIR,
    `${experimentName}-experiment.html`
  );

  if (!fs.existsSync(EXPERIMENTS_OUTPUT_DIR)) {
    fs.mkdirSync(EXPERIMENTS_OUTPUT_DIR, { recursive: true });
  }

  let html = fs.readFileSync(templatePath, "utf8");
  // Elimina cualquier script previo generado
  html = html.replace(/<script id="generated-script">[\s\S]*?<\/script>/, "");
  // Inserta el nuevo script antes de </body>
  html = html.replace(
    "</body>",
    `<script id="generated-script">\n${generatedCode}\n<\/script>\n</body>`
  );
  fs.writeFileSync(experimentHtmlPath, html, "utf8");
  return experimentHtmlPath;
}

/**
 * Genera el HTML de preview de un experimento a partir de un template e inserta el código generado.
 * @param experimentName Nombre del experimento (usado para el archivo)
 * @param generatedCode Código JS generado a insertar en el template
 * @returns Ruta del archivo HTML generado
 */
export async function runExperimentPreview(
  experimentName: string,
  generatedCode: string
): Promise<string> {
  // Usar la nueva ubicación de plantillas y salida
  const templatePath = path.join(TEMPLATES_DIR, "trials_preview_template.html");
  const previewHtmlPath = path.join(
    PREVIEWS_OUTPUT_DIR,
    `${experimentName}-preview.html`
  );

  if (!fs.existsSync(PREVIEWS_OUTPUT_DIR)) {
    fs.mkdirSync(PREVIEWS_OUTPUT_DIR, { recursive: true });
  }

  if (!fs.existsSync(previewHtmlPath)) {
    fs.copyFileSync(templatePath, previewHtmlPath);
  }

  let html = fs.readFileSync(previewHtmlPath, "utf8");
  // Elimina cualquier script previo generado
  html = html.replace(/<script id="generated-script">[\s\S]*?<\/script>/, "");
  // Inserta el nuevo script antes de </body>
  html = html.replace(
    "</body>",
    `<script id="generated-script">\n${generatedCode}\n<\/script>\n</body>`
  );
  fs.writeFileSync(previewHtmlPath, html, "utf8");
  return previewHtmlPath;
}
