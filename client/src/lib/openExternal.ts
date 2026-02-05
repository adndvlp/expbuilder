// Utility to open URLs in the default browser, compatible with Electron and web

export function openExternal(url: string) {
  if (typeof window !== "undefined" && window.electron?.openExternal) {
    window.electron.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
