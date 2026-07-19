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
