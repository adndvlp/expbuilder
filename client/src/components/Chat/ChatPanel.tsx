import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useChat } from "../../contexts/ChatContext";
import ConversationList from "./ConversationList";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { PiFlask, PiPlugs, PiBug, PiPackage } from "react-icons/pi";
import type { IconType } from "react-icons";
import { ProviderBadge, ProviderView } from "./ProviderPicker";

interface Hint { Icon: IconType; text: string; }

const EMPTY_HINTS: Hint[] = [
  { Icon: PiFlask,   text: "Create an image trial with 3 stimuli" },
  { Icon: PiPlugs,   text: "Install the jsPsychSurveyLikert plugin" },
  { Icon: PiBug,     text: "Detect and fix errors in my experiment" },
  { Icon: PiPackage, text: "Export the experiment for production" },
];

function AgentAvatar({ thinking }: { thinking: boolean }) {
  return (
    <div className={`chat-agent-avatar ${thinking ? "thinking" : ""}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      <div className={`chat-agent-dot ${thinking ? "thinking" : ""}`} />
    </div>
  );
}

function ThinkingAvatar() {
  return (
    <div className="chat-msg-avatar agent">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round"
        style={{ width: 13, height: 13, color: "#fff" }}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    </div>
  );
}

function PanelContent({ closing }: { closing: boolean }) {
  const { close, isThinking, activeConversation, newConversation, sendMessage } = useChat();

  const [showSidebar, setShowSidebar] = useState(false);
  const [showProviders, setShowProviders] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = activeConversation?.messages ?? [];
  const isEmpty = messages.length === 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages.length, isThinking]);

  return (
    <div className={`chat-panel${showSidebar ? " with-sidebar" : ""}${closing ? " closing" : ""}`}>
      {showSidebar && <ConversationList />}

      <div className="chat-main">
        {/* ── Header: two rows ── */}
        <div className="chat-header">
          {/* Row 1: identity + actions */}
          <div className="chat-header-row1">
            <button
              className="chat-header-toggle"
              title={showSidebar ? "Hide history" : "History"}
              onClick={() => setShowSidebar((v) => !v)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div className="chat-header-agent">
              <AgentAvatar thinking={isThinking} />
              <div className="chat-agent-info">
                <div className="chat-agent-name">ExpBuilder</div>
                <div className={`chat-agent-subtitle${isThinking ? " thinking" : ""}`}>
                  {isThinking ? "Processing…" : "jsPsych agent"}
                </div>
              </div>
            </div>

            <div className="chat-header-actions">
              <button className="chat-header-btn" title="New conversation" onClick={newConversation}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              <button className="chat-header-btn close" title="Close" onClick={close}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Row 2: provider badge */}
          <div className="chat-header-row2">
            <ProviderBadge onOpen={() => setShowProviders(true)} />
          </div>
        </div>

        {/* ── Provider view / Empty / Messages ── */}
        {showProviders ? (
          <ProviderView onClose={() => setShowProviders(false)} />
        ) : isEmpty ? (
          <div className="chat-empty">
            <div className="chat-empty-glow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3>ExpBuilder Agent</h3>
            <p>Your assistant for building cognitive experiments with jsPsych.</p>
            <div className="chat-empty-hints">
              {EMPTY_HINTS.map(({ Icon, text }) => (
                <button key={text} className="chat-empty-hint" onClick={() => sendMessage(text)}>
                  <span className="chat-empty-hint-icon"><Icon size={14} /></span>
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isThinking && messages[messages.length - 1]?.role === "user" && (
              <div className="chat-thinking">
                <ThinkingAvatar />
                <div className="chat-thinking-bubble">
                  <div className="chat-thinking-dot" />
                  <div className="chat-thinking-dot" />
                  <div className="chat-thinking-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {!showProviders && <ChatInput showHints={isEmpty} />}
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const { isOpen, close } = useChat();
  const [closing, setClosing] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      const t = setTimeout(() => { setVisible(false); setClosing(false); }, 260);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!visible) return null;

  return createPortal(
    <>
      <div className={`chat-backdrop ${closing ? "closing" : ""}`} onClick={close} />
      <PanelContent closing={closing} />
    </>,
    document.body
  );
}
