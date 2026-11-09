type PublishErrorFile = {
  url?: string;
  filename?: string;
  sizeBytes?: number;
};

type PublishResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  code?: string;
  repoUrl?: string;
  pagesUrl?: string;
  oversizedFiles?: PublishErrorFile[];
};

function formatSizeMiB(sizeBytes?: number) {
  if (!sizeBytes) return "";
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function buildPublishErrorMessage(
  result: PublishResponse | null,
  status: number,
) {
  if (result?.code === "GITHUB_FILE_TOO_LARGE") {
    if (result.message || result.error) return result.message || result.error;

    const files =
      result.oversizedFiles
        ?.map((file) =>
          [file.url || file.filename, formatSizeMiB(file.sizeBytes)]
            .filter(Boolean)
            .join(" "),
        )
        .join(", ") || "one or more media files";
    return `GitHub no acepta archivos mayores a 100 MiB: ${files}. Comprime o reemplaza estos archivos antes de publicar.`;
  }

  return (
    result?.message ||
    result?.error ||
    `Server responded with status: ${status}`
  );
}

export async function readPublishResponse(response: Response) {
  try {
    return (await response.json()) as PublishResponse;
  } catch {
    return null;
  }
}
