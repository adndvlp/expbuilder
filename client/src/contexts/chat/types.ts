import type { AIModel, Provider } from "../../components/Chat/types/providers";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  file?: File;
}

export interface ToolCall {
  id: string;
  name: string;
  description?: string;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
  status: "pending" | "running" | "done" | "error";
  durationMs?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
  timestamp: Date;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  conversations: Conversation[];
  activeConvId: string | null;
  activeConversation: Conversation | null;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  sendMessage: (content: string, attachments?: Attachment[]) => void;
  isThinking: boolean;
  abortStream: () => void;
  provider: Provider;
  model: AIModel;
  setProviderAndModel: (providerId: string, modelId: string) => void;
  apiKeys: Record<string, string>;
  setApiKey: (providerId: string, key: string) => void;
}
