// Utilidad para abrir URLs en el navegador predeterminado, compatible con Electron y web

// Declaraciones globales para evitar errores de TypeScript
declare global {
  interface Window {
    electron?: {
      openExternal?: (url: string) => void;
      shell?: {
        openExternal: (url: string) => void;
      };
    };
    require?: (module: string) => any;
  }
}

export function openExternal(url: string) {
  if (typeof window !== "undefined" && window.electron?.openExternal) {
    window.electron.openExternal(url);
  } else if (typeof window !== "undefined" && window.require) {
    try {
      const { shell } = window.require("electron");
      shell.openExternal(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
