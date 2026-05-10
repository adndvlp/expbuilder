/**
 * Live provider catalog — fetches from /api/providers (models.dev + bundled),
 * merges with static icon/color metadata for known providers.
 */
import type { IconType } from "react-icons";
import {
  SiAnthropic, SiOpenai, SiGooglegemini, SiOllama,
  SiPerplexity, SiAmazon, SiMeta,
} from "react-icons/si";
import {
  FiServer, FiZap, FiCpu, FiCloud, FiBox,
} from "react-icons/fi";
import { TbBrandAzure } from "react-icons/tb";
import type { Provider, AIModel, ModelTier } from "../components/Chat/providers";

const API_BASE = "http://localhost:3000";

/* ── Static metadata for well-known providers ─────────── */
const META: Record<string, {
  Icon: IconType;
  color: string;
  keyPlaceholder?: string;
  keyPrefix?: string;
  local?: boolean;
}> = {
  anthropic:       { Icon: SiAnthropic,    color: "#c96442", keyPlaceholder: "sk-ant-api03-…",    keyPrefix: "sk-ant-" },
  openai:          { Icon: SiOpenai,       color: "#10a37f", keyPlaceholder: "sk-proj-…",          keyPrefix: "sk-" },
  google:          { Icon: SiGooglegemini, color: "#4285f4", keyPlaceholder: "AIza…",              keyPrefix: "AIza" },
  "google-vertex": { Icon: SiGooglegemini, color: "#4285f4", keyPlaceholder: "GCP project…" },
  ollama:          { Icon: SiOllama,       color: "#ffffff", local: true },
  lmstudio:        { Icon: FiBox,          color: "#8b5cf6", local: true },
  localai:         { Icon: FiBox,          color: "#6366f1", local: true },
  mistral:         { Icon: FiServer,       color: "#ff7000", keyPlaceholder: "…" },
  groq:            { Icon: FiZap,          color: "#f55036", keyPlaceholder: "gsk_…",              keyPrefix: "gsk_" },
  deepseek:        { Icon: FiCpu,          color: "#4d6bfe", keyPlaceholder: "sk-…" },
  perplexity:      { Icon: SiPerplexity,   color: "#20808d", keyPlaceholder: "pplx-…",             keyPrefix: "pplx-" },
  xai:             { Icon: FiCpu,          color: "#ffffff", keyPlaceholder: "xai-…" },
  "amazon-bedrock":{ Icon: SiAmazon,       color: "#ff9900", keyPlaceholder: "AWS key…" },
  azure:           { Icon: TbBrandAzure,   color: "#0078d4", keyPlaceholder: "Azure key…" },
  openrouter:      { Icon: FiCloud,        color: "#6366f1", keyPlaceholder: "sk-or-…",            keyPrefix: "sk-or-" },
  together:        { Icon: FiServer,       color: "#7c3aed", keyPlaceholder: "…" },
  fireworks:       { Icon: FiZap,          color: "#ef4444", keyPlaceholder: "…" },
  nvidia:          { Icon: FiServer,       color: "#76b900", keyPlaceholder: "nvapi-…" },
  cohere:          { Icon: FiServer,       color: "#39594d", keyPlaceholder: "…" },
  "302ai":         { Icon: FiServer,       color: "#6366f1", keyPlaceholder: "…" },
  meta:            { Icon: SiMeta,         color: "#0866ff", keyPlaceholder: "…" },
};

const FALLBACK_META = { Icon: FiServer, color: "#64748b" };

/* ── Model tier / shortName derivation ─────────────────── */
function deriveTier(modelId: string, modelName: string): ModelTier {
  const s = (modelId + " " + modelName).toLowerCase();
  if (/flash|mini|small|tiny|nano|micro|fast|instant|lite|haiku|turbo/.test(s)) return "fast";
  if (/large|pro|opus|ultra|plus|max|heavy|premier|advanced|big/.test(s)) return "powerful";
  return "balanced";
}

function deriveShortName(name: string): string {
  const words = name.trim().split(/\s+/);
  const short = words.slice(0, 2).join(" ");
  return short.length > 14 ? short.slice(0, 13) + "…" : short;
}

function deriveDescription(m: CatalogModel): string {
  const parts: string[] = [];
  if (m.reasoning) parts.push("Chain-of-thought reasoning");
  if (m.tool_call) parts.push("Tool use");
  if (m.contextK) parts.push(`${m.contextK}K context`);
  if (m.cost?.input != null) parts.push(`$${m.cost.input}/M in`);
  return parts.join(" · ") || m.name;
}

/* ── Raw catalog shape from backend ────────────────────── */
interface CatalogModel {
  id: string;
  name: string;
  contextK: number | null;
  outputK: number | null;
  tool_call: boolean;
  reasoning: boolean;
  cost: { input: number; output: number } | null;
}

interface CatalogProvider {
  id: string;
  name: string;
  source: string;
  env: string[];
  npm: string | null;
  api: string | null;
  models: CatalogModel[];
}

function catalogToProvider(cp: CatalogProvider): Provider {
  const meta = META[cp.id] ?? FALLBACK_META;
  const requiresKey = !meta.local && cp.env.length > 0;

  const models: AIModel[] = cp.models.map((m) => ({
    id: m.id,
    name: m.name,
    shortName: deriveShortName(m.name),
    contextK: m.contextK ?? 0,
    tier: deriveTier(m.id, m.name),
    description: deriveDescription(m),
  }));

  return {
    id: cp.id,
    name: cp.name,
    Icon: meta.Icon,
    color: meta.color,
    requiresKey,
    keyPlaceholder: meta.keyPlaceholder,
    keyPrefix: meta.keyPrefix,
    local: meta.local,
    models,
  };
}

/* ── Singleton state ────────────────────────────────────── */
let cached: Provider[] | null = null;
let fetchPromise: Promise<Provider[]> | null = null;
const listeners = new Set<() => void>();

export function subscribeProviders(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getProvidersSnapshot(): Provider[] {
  return cached ?? [];
}

export async function loadProviders(): Promise<Provider[]> {
  if (cached) return cached;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(`${API_BASE}/api/providers`)
    .then((r) => r.json() as Promise<CatalogProvider[]>)
    .then((data) => {
      cached = data.map(catalogToProvider).sort((a, b) => {
        // known providers (have custom meta) first
        const aKnown = META[a.id] ? 0 : 1;
        const bKnown = META[b.id] ? 0 : 1;
        return aKnown - bKnown || a.name.localeCompare(b.name);
      });
      fetchPromise = null;
      listeners.forEach((cb) => cb());
      return cached;
    })
    .catch((err) => {
      fetchPromise = null;
      console.warn("[providerCatalog] fetch failed:", err.message);
      // fall back to empty — static PROVIDERS remain available via ChatContext
      return cached ?? [];
    });

  return fetchPromise;
}

/** Sync lookup — returns undefined if catalog not loaded yet */
export function findCatalogProvider(id: string): Provider | undefined {
  return cached?.find((p) => p.id === id);
}

/** Kick off background load (call once at app start) */
export function prefetchProviders() {
  if (!cached && !fetchPromise) loadProviders();
}
