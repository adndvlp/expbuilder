// Utilidad para abrir URLs en el navegador predeterminado, compatible con Electron y web

export function openExternal(url: string) {
  if (typeof window !== "undefined" && window.electron?.openExternal) {
    window.electron.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
