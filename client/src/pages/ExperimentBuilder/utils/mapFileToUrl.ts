export type UploadedFile = {
  name: string;
  url: string;
  type: string;
};

/**
 * Maps a filename to its full URL using the uploadedFiles list
 * @param value - The value to map (filename, partial path, or full URL)
 * @param uploadedFiles - List of uploaded files
 * @returns The mapped URL or the original value if no match found
 */
export function mapFileToUrl(value: any, uploadedFiles: UploadedFile[]): any {
  if (!value) return value;

  // Si es un array, procesar cada elemento
  if (Array.isArray(value)) {
    return value.map((v) => mapFileToUrl(v, uploadedFiles));
  }

  // Si es un string que no es URL, buscar en uploadedFiles
  if (
    typeof value === "string" &&
    value.trim() &&
    !/^https?:\/\//.test(value)
  ) {
    const found = uploadedFiles.find(
      (f) =>
        f.name &&
        (f.name === value || f.url === value || value.endsWith(f.name)),
    );
    return found && found.url ? found.url : value;
  }

  return value;
}
