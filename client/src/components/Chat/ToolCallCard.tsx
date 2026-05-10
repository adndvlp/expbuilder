import { useState } from "react";
import type { ToolCall } from "../../contexts/ChatContext";

interface Props {
  toolCall: ToolCall;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function StatusEl({ status }: { status: ToolCall["status"] }) {
  switch (status) {
    case "pending":
      return <div className="chat-tool-pending" />;
    case "running":
      return <div className="chat-tool-spinner" />;
    case "done":
      return (
        <div className="chat-tool-check">
          <CheckIcon />
        </div>
      );
    case "error":
      return <div className="chat-tool-err">✗</div>;
  }
}

export default function ToolCallCard({ toolCall }: Props) {
  const [open, setOpen] = useState(false);
  const hasDetails = Object.keys(toolCall.args).length > 0 || !!toolCall.result;

  return (
    <div className={`chat-tool-card ${toolCall.status}`}>
      <div
        className="chat-tool-header"
        onClick={() => hasDetails && setOpen((v) => !v)}
        style={{ cursor: hasDetails ? "pointer" : "default" }}
      >
        <div className="chat-tool-status">
          <StatusEl status={toolCall.status} />
        </div>

        <div className="chat-tool-names">
          <span className="chat-tool-fn">{toolCall.name}()</span>
          {toolCall.description && (
            <span className="chat-tool-desc">{toolCall.description}</span>
          )}
        </div>

        {toolCall.status === "done" && toolCall.durationMs !== undefined && (
          <span className="chat-tool-ms">{toolCall.durationMs}ms</span>
        )}

        {hasDetails && (
          <span className={`chat-tool-chevron ${open ? "open" : ""}`}>
            <ChevronIcon />
          </span>
        )}
      </div>

      <div className={`chat-tool-body ${open ? "open" : ""}`}>
        {Object.keys(toolCall.args).length > 0 && (
          <div className="chat-tool-section">
            <div className="chat-tool-label">Parameters</div>
            <pre className="chat-tool-code">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
        )}

        {toolCall.result && (
          <div className="chat-tool-section">
            <div className="chat-tool-label">Result</div>
            <pre className={`chat-tool-code ${toolCall.status === "error" ? "error" : "result"}`}>
              {toolCall.result}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
