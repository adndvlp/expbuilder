// Declaración global para window.electronAPI
export {};

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}
