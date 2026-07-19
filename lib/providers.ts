// Client-safe provider metadata. No SDK imports here, so this can be imported
// into the browser UI without bundling any provider SDK. The server-only model
// factory lives in lib/models.ts.

export type ProviderId = "anthropic" | "google" | "xai" | "openai" | "mistral";

// Order matters for auto-detect: distinctive prefixes are checked before the
// generic "sk-" so an Anthropic key is not mistaken for OpenAI.
export const PROVIDERS: {
  id: ProviderId;
  label: string;
  short: string;
  placeholder: string;
  keyUrl: string;
  prefix: string | null;
}[] = [
  { id: "anthropic", label: "Anthropic · Claude", short: "Claude", placeholder: "sk-ant-...", keyUrl: "https://console.anthropic.com/settings/keys", prefix: "sk-ant-" },
  { id: "google", label: "Google · Gemini", short: "Gemini", placeholder: "AIza...", keyUrl: "https://aistudio.google.com/apikey", prefix: "AIza" },
  { id: "xai", label: "xAI · Grok", short: "Grok", placeholder: "xai-...", keyUrl: "https://console.x.ai", prefix: "xai-" },
  { id: "openai", label: "OpenAI · GPT", short: "GPT", placeholder: "sk-...", keyUrl: "https://platform.openai.com/api-keys", prefix: "sk-" },
  { id: "mistral", label: "Mistral", short: "Mistral", placeholder: "your Mistral key", keyUrl: "https://console.mistral.ai/api-keys", prefix: null },
];

export function detectProvider(key: string): ProviderId | null {
  const k = key.trim();
  for (const p of PROVIDERS) {
    if (p.prefix && k.startsWith(p.prefix)) return p.id;
  }
  return null;
}

export function providerShort(id: ProviderId): string {
  return PROVIDERS.find((p) => p.id === id)?.short ?? id;
}

// A spread of models per provider, ordered stronger to lighter. A single
// provider key therefore still runs the evaluators across more than one model
// (real construction diversity within one lineage), rather than one model wearing
// every lens. These ids are the tested/standard direct-provider ids. Client-safe
// (strings only); the server builds the actual model from these in lib/models.ts.
export const PROVIDER_MODELS: Record<ProviderId, string[]> = {
  anthropic: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  openai: ["gpt-4o", "gpt-4o-mini"],
  google: ["gemini-2.0-flash"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
  xai: ["grok-2-latest"],
};

// A short, readable model label for the lane header (drops the date suffix etc.).
export function modelShort(modelId: string): string {
  const map: Record<string, string> = {
    "claude-sonnet-4-6": "Sonnet",
    "claude-haiku-4-5-20251001": "Haiku",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o mini",
    "gemini-2.0-flash": "Gemini Flash",
    "mistral-large-latest": "Mistral L",
    "mistral-small-latest": "Mistral S",
    "grok-2-latest": "Grok 2",
  };
  return map[modelId] ?? modelId;
}
