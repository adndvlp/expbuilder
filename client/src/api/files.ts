import fs from "fs";
import path from "path";

// Carpeta base donde se guardan los archivos de experimentos
const BASE_DIR = path.resolve(__dirname, "../../../../", "JsPsych/server");

function getExperimentFolder(experimentID: string, experimentName?: string) {
  return experimentName ? `${experimentName}-experiment` : experimentID;
}

// Subir un archivo (buffer) a una carpeta de experimento y tipo
export function uploadFile({
  experimentID,
  experimentName,
  type,
  filename,
  buffer,
}: {
  experimentID: string;
  experimentName?: string;
  type: "img" | "aud" | "vid" | "others";
  filename: string;
  buffer: Buffer;
}): string {
  const folder = path.join(
    BASE_DIR,
    getExperimentFolder(experimentID, experimentName),
    type
  );
  fs.mkdirSync(folder, { recursive: true });
  const filePath = path.join(folder, filename);
  fs.writeFileSync(filePath, buffer);
  return `${getExperimentFolder(experimentID, experimentName)}/${type}/${filename}`;
}

// Subir múltiples archivos
export function uploadFiles({
  experimentID,
  experimentName,
  type,
  files,
}: {
  experimentID: string;
  experimentName?: string;
  type: "img" | "aud" | "vid" | "others";
  files: { filename: string; buffer: Buffer }[];
}): string[] {
  return files.map((file) =>
    uploadFile({
      experimentID,
      experimentName,
      type,
      filename: file.filename,
      buffer: file.buffer,
    })
  );
}

// Listar archivos de un tipo/carpeta para un experimento
export function listFiles({
  experimentID,
  experimentName,
  type,
}: {
  experimentID: string;
  experimentName?: string;
  type: "img" | "aud" | "vid" | "others" | "all";
}): { name: string; url: string; type: string }[] {
  const base = path.join(
    BASE_DIR,
    getExperimentFolder(experimentID, experimentName)
  );
  const types = type === "all" ? ["img", "aud", "vid", "others"] : [type];
  let files: { name: string; url: string; type: string }[] = [];
  types.forEach((t) => {
    const dir = path.join(base, t);
    if (fs.existsSync(dir)) {
      const typeFiles = fs.readdirSync(dir).map((filename) => ({
        name: filename,
        url: `${getExperimentFolder(experimentID, experimentName)}/${t}/${filename}`,
        type: t,
      }));
      files = files.concat(typeFiles);
    }
  });
  return files;
}

// Eliminar un archivo
export function deleteFile({
  experimentID,
  experimentName,
  type,
  filename,
}: {
  experimentID: string;
  experimentName?: string;
  type: "img" | "aud" | "vid" | "others";
  filename: string;
}): boolean {
  const filePath = path.join(
    BASE_DIR,
    getExperimentFolder(experimentID, experimentName),
    type,
    filename
  );
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}
