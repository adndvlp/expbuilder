import { parseSSEChunk } from "../utils/sse";

const API_BASE = import.meta.env.VITE_API_URL;

interface StreamChatOptions {
  providerId: string;
  modelId: string;
  apiKey?: string;
  messages: Array<{ role: string; content: string }>;
  signal: AbortSignal;
  onDelta: (value: { content: string; reasoning: string }) => void;
}

export async function streamChat(options: StreamChatOptions) {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerId: options.providerId,
      modelId: options.modelId,
      apiKey: options.apiKey,
      messages: options.messages,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.error ?? response.statusText);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let rawText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lastDouble = buffer.lastIndexOf("\n\n");
    if (lastDouble < 0) continue;
    const complete = buffer.slice(0, lastDouble + 2);
    buffer = buffer.slice(lastDouble + 2);

    for (const { event, data } of parseSSEChunk(complete)) {
      if (options.signal.aborted) break;
      if (event === "delta") {
        const { text } = JSON.parse(data);
        rawText += text;
        const reasoningParts: string[] = [];
        const content = rawText.replace(
          /<think>([\s\S]*?)<\/think>/g,
          (_, reasoning: string) => {
            reasoningParts.push(reasoning);
            return "";
          },
        );
        options.onDelta({
          content,
          reasoning: reasoningParts.join("\n\n"),
        });
      } else if (event === "done") {
        const parsed = JSON.parse(data);
        if (parsed.toolsUsed) {
          window.dispatchEvent(new CustomEvent("experiment-data-changed"));
        }
        break;
      } else if (event === "error") {
        break;
      }
    }
  }
}
