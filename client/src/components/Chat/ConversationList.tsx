import { useState, useRef } from "react";
import { useChat, Conversation } from "../../contexts/ChatContext";
import { PiChatDots } from "react-icons/pi";

function timeLabel(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Earlier";
}

function groupByDate(convs: Conversation[]) {
  const groups: Record<string, Conversation[]> = {};
  for (const c of convs) {
    const label = timeLabel(c.updatedAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  }
  return groups;
}

interface ConvItemProps {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

function ConvItem({ conv, isActive, onSelect, onDelete, onRename }: ConvItemProps) {
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(conv.title);
  const inputRef = useRef<HTMLInputElement>(null);

  function startRename(e: React.MouseEvent) {
    e.stopPropagation();
    setRenameVal(conv.title);
    setRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitRename() {
    const trimmed = renameVal.trim();
    if (trimmed && trimmed !== conv.title) onRename(trimmed);
    setRenaming(false);
  }

  function handleRenameKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setRenaming(false);
  }

  return (
    <div
      className={`chat-conv-item ${isActive ? "active" : ""}`}
      onClick={onSelect}
    >
      <svg className="chat-conv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>

      {renaming ? (
        <input
          ref={inputRef}
          className="chat-conv-rename-input"
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleRenameKey}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span className="chat-conv-name">{conv.title}</span>
      )}

      {!renaming && (
        <div className="chat-conv-actions">
          <button
            className="chat-conv-action-btn rename"
            title="Rename"
            onClick={startRename}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            className="chat-conv-action-btn"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default function ConversationList() {
  const { conversations, activeConvId, newConversation, selectConversation, deleteConversation, renameConversation } = useChat();
  const groups = groupByDate(conversations);
  const ORDER = ["Today", "Yesterday", "This week", "Earlier"];

  return (
    <div className="chat-sidebar">
      <div className="chat-sidebar-header">
        <span className="chat-sidebar-title">Conversations</span>
        <button className="chat-new-btn" title="New conversation" onClick={newConversation}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="chat-conv-list">
        {conversations.length === 0 ? (
          <div className="chat-sidebar-empty">
            <div className="chat-sidebar-empty-icon"><PiChatDots size={30} /></div>
            <p>No conversations yet. Start chatting with the agent.</p>
          </div>
        ) : (
          ORDER.filter((g) => groups[g]).map((group) => (
            <div key={group}>
              <div className="chat-conv-date">{group}</div>
              {groups[group].map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === activeConvId}
                  onSelect={() => selectConversation(conv.id)}
                  onDelete={() => deleteConversation(conv.id)}
                  onRename={(title) => renameConversation(conv.id, title)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
