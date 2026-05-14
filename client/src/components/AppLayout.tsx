import { Outlet, useLocation } from "react-router-dom";
import { ChatProvider } from "../contexts/ChatContext";
import ChatPanel from "./Chat/ChatPanel";
import ChatFAB from "./Chat/ChatFAB";
import "./Chat/chat.css";

export default function AppLayout() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  return (
    <ChatProvider>
      <Outlet />
      {!isLanding && (
        <>
          <ChatFAB />
          <ChatPanel />
        </>
      )}
    </ChatProvider>
  );
}
