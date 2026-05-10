import { useChat } from "../../contexts/ChatContext";

export default function ChatFAB() {
  const { toggle, isOpen, isThinking } = useChat();

  return (
    <button
      className="chat-fab"
      onClick={toggle}
      aria-label={isOpen ? "Cerrar agente" : "Abrir agente"}
      title={isOpen ? "Cerrar agente" : "Abrir agente"}
    >
      {isThinking && (
        <>
          <span className="chat-fab-ring" />
          <span className="chat-fab-ring" />
        </>
      )}

      {/* Chat icon */}
      <span className={`chat-fab-icon ${isOpen ? "hidden" : ""}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <circle cx="9" cy="11" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="12" cy="11" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="15" cy="11" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      </span>

      {/* Close icon */}
      <span className={`chat-fab-icon ${!isOpen ? "hidden" : ""}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    </button>
  );
}
