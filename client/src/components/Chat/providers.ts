import type { IconType } from "react-icons";
import {
  SiOpenai,
  SiAnthropic,
  SiGooglegemini,
  SiOllama,
  SiPerplexity,
} from "react-icons/si";
import { FiServer, FiZap, FiCpu } from "react-icons/fi";

export type ModelTier = "fast" | "balanced" | "powerful";

export interface AIModel {
  id: string;
  name: string;
  shortName: string;
  contextK: number;
  description: string;
  tier: ModelTier;
}

export interface Provider {
  id: string;
  name: string;
  Icon: IconType;
  color: string;           // accent color for this provider
  requiresKey: boolean;
  keyPlaceholder?: string;
  keyPrefix?: string;      // e.g. "sk-ant-" for display masking
  local?: boolean;         // Ollama = no API key
  models: AIModel[];
}

export const PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    Icon: SiAnthropic,
    color: "#c96442",
    requiresKey: true,
    keyPlaceholder: "sk-ant-api03-…",
    keyPrefix: "sk-ant-",
    models: [
      {
        id: "claude-opus-4-7",
        name: "Claude Opus 4.7",
        shortName: "Opus 4.7",
        contextK: 200,
        tier: "powerful",
        description: "Most capable. Best for complex reasoning tasks.",
      },
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        shortName: "Sonnet 4.6",
        contextK: 200,
        tier: "balanced",
        description: "Best balance between intelligence and speed.",
      },
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        shortName: "Haiku 4.5",
        contextK: 200,
        tier: "fast",
        description: "Ultra-fast for simple and repetitive tasks.",
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    Icon: SiOpenai,
    color: "#10a37f",
    requiresKey: true,
    keyPlaceholder: "sk-proj-…",
    keyPrefix: "sk-",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        shortName: "GPT-4o",
        contextK: 128,
        tier: "powerful",
        description: "Multimodal. Most capable from OpenAI.",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o mini",
        shortName: "4o-mini",
        contextK: 128,
        tier: "fast",
        description: "Fast and cost-efficient for most tasks.",
      },
      {
        id: "o3",
        name: "o3",
        shortName: "o3",
        contextK: 200,
        tier: "powerful",
        description: "Extended reasoning. For hard problems.",
      },
      {
        id: "o4-mini",
        name: "o4-mini",
        shortName: "o4-mini",
        contextK: 200,
        tier: "balanced",
        description: "Fast and efficient reasoning.",
      },
    ],
  },
  {
    id: "google",
    name: "Google",
    Icon: SiGooglegemini,
    color: "#4285f4",
    requiresKey: true,
    keyPlaceholder: "AIza…",
    keyPrefix: "AIza",
    models: [
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        shortName: "Flash 2.0",
        contextK: 1000,
        tier: "fast",
        description: "Fastest. Massive 1M token context.",
      },
      {
        id: "gemini-2.0-pro",
        name: "Gemini 2.0 Pro",
        shortName: "Pro 2.0",
        contextK: 2000,
        tier: "powerful",
        description: "Most capable from Google with advanced reasoning.",
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        shortName: "1.5 Pro",
        contextK: 2000,
        tier: "balanced",
        description: "2M token context. Long document analysis.",
      },
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    Icon: SiOllama,
    color: "#ffffff",
    requiresKey: false,
    local: true,
    models: [
      {
        id: "llama3.2:3b",
        name: "Llama 3.2 3B",
        shortName: "Llama 3.2 3B",
        contextK: 128,
        tier: "fast",
        description: "Small local model. Instant responses.",
      },
      {
        id: "llama3.1:8b",
        name: "Llama 3.1 8B",
        shortName: "Llama 3.1 8B",
        contextK: 128,
        tier: "balanced",
        description: "Good quality/speed balance for local use.",
      },
      {
        id: "llama3.3:70b",
        name: "Llama 3.3 70B",
        shortName: "Llama 3.3 70B",
        contextK: 128,
        tier: "powerful",
        description: "Most capable from Meta. Requires powerful GPU.",
      },
      {
        id: "qwen2.5-coder:7b",
        name: "Qwen 2.5 Coder 7B",
        shortName: "Qwen Coder",
        contextK: 128,
        tier: "balanced",
        description: "Code-specialized. Great for your builder.",
      },
      {
        id: "mistral:7b",
        name: "Mistral 7B",
        shortName: "Mistral 7B",
        contextK: 32,
        tier: "fast",
        description: "Fast and efficient. European open-source model.",
      },
      {
        id: "codellama:13b",
        name: "CodeLlama 13B",
        shortName: "CodeLlama",
        contextK: 100,
        tier: "balanced",
        description: "Specialized in code and debugging.",
      },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    Icon: FiServer,
    color: "#ff7000",
    requiresKey: true,
    keyPlaceholder: "…",
    models: [
      {
        id: "mistral-large-2",
        name: "Mistral Large 2",
        shortName: "Large 2",
        contextK: 128,
        tier: "powerful",
        description: "Most capable from Mistral for complex tasks.",
      },
      {
        id: "mistral-small-3",
        name: "Mistral Small 3",
        shortName: "Small 3",
        contextK: 32,
        tier: "fast",
        description: "Ultra-efficient. Ideal for production.",
      },
      {
        id: "codestral",
        name: "Codestral",
        shortName: "Codestral",
        contextK: 256,
        tier: "balanced",
        description: "Code-specialized. 80+ languages.",
      },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    Icon: FiZap,
    color: "#f55036",
    requiresKey: true,
    keyPlaceholder: "gsk_…",
    keyPrefix: "gsk_",
    models: [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B",
        shortName: "Llama 70B",
        contextK: 128,
        tier: "powerful",
        description: "Llama 70B with Groq ultra-fast inference.",
      },
      {
        id: "llama-3.1-8b-instant",
        name: "Llama 3.1 8B Instant",
        shortName: "Llama 8B",
        contextK: 128,
        tier: "fast",
        description: "Fastest. Latency < 200ms.",
      },
      {
        id: "mixtral-8x7b-32768",
        name: "Mixtral 8x7B",
        shortName: "Mixtral",
        contextK: 32,
        tier: "balanced",
        description: "MoE architecture. Excellent at code.",
      },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    Icon: FiCpu,
    color: "#4d6bfe",
    requiresKey: true,
    keyPlaceholder: "sk-…",
    models: [
      {
        id: "deepseek-chat",
        name: "DeepSeek V3",
        shortName: "V3",
        contextK: 64,
        tier: "powerful",
        description: "MoE 671B. GPT-4-level performance at lower cost.",
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1",
        shortName: "R1",
        contextK: 64,
        tier: "powerful",
        description: "o1-style reasoning. Visible chain-of-thought.",
      },
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    Icon: SiPerplexity,
    color: "#20808d",
    requiresKey: true,
    keyPlaceholder: "pplx-…",
    keyPrefix: "pplx-",
    models: [
      {
        id: "sonar-pro",
        name: "Sonar Pro",
        shortName: "Sonar Pro",
        contextK: 200,
        tier: "powerful",
        description: "Real-time web search. Always up-to-date.",
      },
      {
        id: "sonar",
        name: "Sonar",
        shortName: "Sonar",
        contextK: 128,
        tier: "fast",
        description: "Fast and cost-efficient web search.",
      },
    ],
  },
];

export const DEFAULT_PROVIDER = PROVIDERS[0]; // Anthropic
export const DEFAULT_MODEL = PROVIDERS[0].models[1]; // Sonnet 4.6

export function findProvider(id: string): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? DEFAULT_PROVIDER;
}

export function findModel(provider: Provider, modelId: string): AIModel {
  return provider.models.find((m) => m.id === modelId) ?? provider.models[0];
}

export const TIER_LABELS: Record<ModelTier, string> = {
  fast: "Fast",
  balanced: "Balanced",
  powerful: "Powerful",
};

export const TIER_COLORS: Record<ModelTier, string> = {
  fast: "#00b87a",
  balanced: "#3d92b4",
  powerful: "#d4af37",
};
