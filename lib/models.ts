import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import { PROVIDER_MODELS, type ProviderId } from "./providers";

// Server-only. Builds a language model from a provider id, the user's own key,
// and a specific model id. The evaluators spread across the provider's model
// list so a single key still runs on more than one model; the value is
// construction diversity, not peak capability in any one lane. Hyphenated forms
// are the correct direct-provider model ids (the dotted forms are Vercel AI
// Gateway slugs, and this app calls the providers directly on the user's key,
// not via a gateway).
export function buildModelById(
  provider: ProviderId,
  apiKey: string,
  modelId: string
): LanguageModel {
  const key = apiKey.trim();
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey: key })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: key })(modelId);
    case "mistral":
      return createMistral({ apiKey: key })(modelId);
    case "xai":
      return createXai({ apiKey: key })(modelId);
    case "anthropic":
    default:
      return createAnthropic({ apiKey: key })(modelId);
  }
}

// Default model for a provider (the strongest in its spread). Used for synthesis.
export function buildModel(provider: ProviderId, apiKey: string): LanguageModel {
  return buildModelById(provider, apiKey, PROVIDER_MODELS[provider][0]);
}
