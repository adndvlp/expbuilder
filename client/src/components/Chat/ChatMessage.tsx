import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Message } from "../../contexts/ChatContext";
import ToolCallCard from "./ToolCallCard";

interface Props {
  message: Message;
}

function AgentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4" />
      <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
    </svg>
  );
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button className={`chat-code-copy ${copied ? "copied" : ""}`} onClick={handleCopy}>
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function ReasoningBlock({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (!text && !isStreaming) return null;

  return (
    <div className="chat-reasoning" onClick={() => setExpanded(!expanded)}>
      <div className="chat-reasoning-toggle">
        <svg
          className={`chat-reasoning-chevron ${expanded ? "open" : ""}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span>{isStreaming ? "Thinking…" : "Thought for a bit"}</span>
      </div>
      {expanded && text && (
        <div className="chat-reasoning-content">
          {text}
        </div>
      )}
    </div>
  );
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";
  const hasReasoning = !!(message.reasoning || (message.isStreaming && !message.content));

  return (
    <div className={`chat-msg-group ${isUser ? "user" : "assistant"}`}>
      <div className="chat-msg-row">
        <div className={`chat-msg-avatar ${isUser ? "user" : "agent"}`}>
          {isUser ? <UserIcon /> : <AgentIcon />}
        </div>

        <div className="chat-bubble">
          {/* Inline attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="chat-bubble-attachments">
              {message.attachments.map((a) => (
                <div key={a.id} className="chat-bubble-attach">
                  {a.type.startsWith("image/") ? (
                    <img className="chat-bubble-attach-img" src={a.url} alt={a.name} />
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="chat-bubble-attach-name">{a.name}</span>
                      <span style={{ fontSize: 10, color: "var(--cts)" }}>{formatSize(a.size)}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Reasoning / thinking section */}
          {!isUser && (
            <ReasoningBlock
              text={message.reasoning ?? ""}
              isStreaming={!!(message.isStreaming && !message.content)}
            />
          )}

          {/* Content */}
          {message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...rest }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeStr = String(children).replace(/\n$/, "");
                  if (!match) {
                    return (
                      <code className={className} {...rest}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <div className="chat-code-block">
                      <span className="chat-code-lang">{match[1]}</span>
                      <CopyCodeButton code={codeStr} />
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          borderRadius: 8,
                          fontSize: 12,
                          paddingTop: 28,
                          background: "rgba(0,0,0,0.3)",
                          border: "1px solid var(--cborder)",
                        }}
                      >
                        {codeStr}
                      </SyntaxHighlighter>
                    </div>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            message.isStreaming && !message.reasoning && (
              <span style={{ color: "var(--cts)", fontStyle: "italic", fontSize: 13 }}>
                Typing…
              </span>
            )
          )}

          {/* Streaming cursor */}
          {message.isStreaming && message.content && <span className="chat-cursor" />}
        </div>
      </div>

      {/* Tool call cards */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="chat-tool-calls">
          {message.toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}

      {/* Timestamp */}
      <div className="chat-msg-meta">
        <span className="chat-msg-time">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}
