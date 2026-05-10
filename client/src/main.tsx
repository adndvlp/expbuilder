import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./pages";
import "./index.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { ChatProvider } from "./contexts/ChatContext";
import ChatPanel from "./components/Chat/ChatPanel";
import ChatFAB from "./components/Chat/ChatFAB";
import "./components/Chat/chat.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChatProvider>
      <RouterProvider router={router} />
      <ChatFAB />
      <ChatPanel />
    </ChatProvider>
  </StrictMode>
);
