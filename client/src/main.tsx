import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import App from "./App.tsx";
import "bootstrap/dist/css/bootstrap.min.css";
import DevModeProvider from "./providers/DevModeProvider.tsx";
import PluginsProvider from "./providers/PluginsProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DevModeProvider>
      <PluginsProvider>
        <App />
      </PluginsProvider>
    </DevModeProvider>
  </StrictMode>
);
