import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import type { ProviderId } from "./providers";

// Server-only. Builds a language model from a provider id and the user's own
// key. Default model per provider is deliberately cheap and fast: the council's
// value is provider diversity across evaluators, not peak capability in any one
// lane. These IDs drift; update as needed. Hyphenated forms are the correct
// direct-provider model ids (the dotted forms are Vercel AI Gateway slugs, and
// this app calls the providers directly on the user's key, not via a gateway).
export function buildModel(provider: ProviderId, apiKey: string): LanguageModel {
  const key = apiKey.trim();
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey: key })("gpt-4o-mini");
    case "google":
      return createGoogleGenerativeAI({ apiKey: key })("gemini-2.0-flash");
    case "mistral":
      return createMistral({ apiKey: key })("mistral-small-latest");
    case "xai":
      return createXai({ apiKey: key })("grok-2-latest");
    case "anthropic":
    default:
      return createAnthropic({ apiKey: key })("claude-haiku-4-5-20251001");
  }
}
