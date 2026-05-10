import {
  useRef, useState, useCallback,
  DragEvent, ChangeEvent, KeyboardEvent,
} from "react";
import type { Attachment } from "../../contexts/ChatContext";
import { useChat } from "../../contexts/ChatContext";
import { FiZap, FiArrowDownCircle } from "react-icons/fi";

function uid() { return Math.random().toString(36).slice(2, 10); }

function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        id: uid(),
        name: file.name,
        type: file.type,
        url: e.target?.result as string,
        size: file.size,
        file,
      });
    };
    reader.readAsDataURL(file);
  });
}

interface Props {
  showHints?: boolean;
}

const INPUT_HINTS = [
  "Create an image trial with 3 stimuli",
  "Install the jsPsychSurveyLikert plugin",
  "Why is my experiment failing?",
  "Export the complete experiment",
];

export default function ChatInput({ showHints }: Props) {
  const { sendMessage, isThinking, abortStream } = useChat();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }

  function handleTextChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    autoResize();
  }

  const submit = useCallback(() => {
    if (!text.trim() || isThinking) return;
    sendMessage(text.trim(), attachments.length > 0 ? attachments : undefined);
    setText("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  }, [text, attachments, isThinking, sendMessage]);

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const next = await Promise.all(arr.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...next]);
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handleHint(hint: string) {
    setText(hint);
    setTimeout(() => { textareaRef.current?.focus(); autoResize(); }, 0);
  }

  return (
    <div className="chat-input-area">
      {/* Quick hints when no messages */}
      {showHints && (
        <div className="chat-empty-hints" style={{ marginBottom: 10 }}>
          {INPUT_HINTS.map((h) => (
            <button key={h} className="chat-empty-hint" onClick={() => handleHint(h)}>
              <span className="chat-empty-hint-icon"><FiZap size={13} /></span>
              {h}
            </button>
          ))}
        </div>
      )}

      <div
        className={`chat-input-wrap ${dragOver ? "drag-over" : ""}`}
        onDrop={handleDrop}
        onDragOver={(e: DragEvent) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        {dragOver && (
          <div className="chat-drop-overlay">
            <FiArrowDownCircle size={18} style={{ marginRight: 6 }} />
            <span>Drop files here</span>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="chat-pending-attachments">
            <div className="chat-attach-list">
              {attachments.map((a) => (
                <div key={a.id} className="chat-attach-chip">
                  {a.type.startsWith("image/") ? (
                    <img src={a.url} alt={a.name} />
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  <span className="chat-attach-name">{a.name}</span>
                  <button className="chat-attach-remove" onClick={() => removeAttachment(a.id)}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Tell the agent what you need…"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKey}
          rows={1}
        />

        <div className="chat-input-toolbar">
          {/* Attach */}
          <button
            className="chat-toolbar-btn"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.txt,.js,.ts,.json,.csv,.py"
          />

          <div className="chat-input-spacer" />

          {/* Send / Stop */}
          {isThinking ? (
            <button className="chat-send-btn stop" onClick={abortStream} title="Stop">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              className="chat-send-btn"
              onClick={submit}
              disabled={!text.trim()}
              title="Send (Enter)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="chat-input-hint">
        <kbd>Enter</kbd> send · <kbd>Shift+Enter</kbd> new line · drag files to the area
      </div>
    </div>
  );
}
