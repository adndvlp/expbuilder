export const GITHUB_FILE_LIMIT_BYTES =
  Number(process.env.GITHUB_FILE_LIMIT_BYTES) || 100 * 1024 * 1024;

function formatSizeMiB(sizeBytes) {
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function buildOversizedMediaMessage(files) {
  const fileList = files
    .map((file) => `${file.url} (${formatSizeMiB(file.sizeBytes)})`)
    .join(", ");
  return `GitHub no acepta archivos mayores a 100 MiB: ${fileList}. Comprime o reemplaza estos archivos antes de publicar.`;
}

export function isPublishableMediaFile(filename) {
  return filename !== ".DS_Store" && !filename.startsWith(".upload-");
}
