import fetch from "../../../../../utils/fetch-with-timeout.js";
import { PROVIDER_ENDPOINTS as endpoints } from "../../../../../utils/provider-endpoints.js";

export async function postFile(token, folderIdentifier, filedata, filename) {
  const filePath = `${folderIdentifier}/${filename}`;

  const result = await fetch(
    `${endpoints.dropbox.contentBase}/2/files/upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({
          path: filePath,
          mode: "overwrite",
          autorename: false,
          mute: false,
        }),
        "Content-Type": "application/octet-stream",
      },
      body: filedata,
    },
  );

  if (result.status !== 200) {
    const data = await result.json().catch(() => ({}));
    return {
      success: false,
      errorCode: result.status,
      errorText: data.error_summary || result.statusText,
    };
  }

  return { success: true, errorCode: null, errorText: null };
}
