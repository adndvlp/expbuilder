import {
  mapFileToUrl,
  type UploadedFile,
} from "./mapFileToUrl";

const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const MEDIA_PATH_PATTERN = /^(?:img|aud|vid|others)\//;

type MediaPreviewUrlOptions = {
  apiUrl?: string;
  experimentID?: string;
  uploadedFiles?: UploadedFile[];
};

export function resolveMediaPreviewUrl(
  value: string,
  {
    apiUrl = import.meta.env.VITE_API_URL || "",
    experimentID,
    uploadedFiles = [],
  }: MediaPreviewUrlOptions = {},
): string {
  if (!value) return "";

  const mappedValue =
    uploadedFiles.length > 0 ? mapFileToUrl(value, uploadedFiles) : value;
  if (typeof mappedValue !== "string" || !mappedValue) return "";
  if (ABSOLUTE_URL_PATTERN.test(mappedValue)) return mappedValue;

  const relativePath = mappedValue.replace(/^\/+/, "");
  const scopedPath =
    experimentID && MEDIA_PATH_PATTERN.test(relativePath)
      ? `${encodeURIComponent(experimentID)}/${relativePath}`
      : relativePath;
  const normalizedApiUrl = apiUrl.replace(/\/+$/, "");

  return normalizedApiUrl
    ? `${normalizedApiUrl}/${scopedPath}`
    : `/${scopedPath}`;
}
