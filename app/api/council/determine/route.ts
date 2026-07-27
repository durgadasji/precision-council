import { generateText } from "ai";
import { buildModelById } from "@/lib/models";
import { PROVIDER_MODELS, type ProviderId } from "@/lib/providers";
import {
  DETERMINATIONS,
  buildDeterminationPrompt,
  parseCall,
} from "@/lib/determinations";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { determination, provider, model, apiKey, claim, evidence } =
    (await req.json()) as {
      determination: string;
      provider: ProviderId;
      model?: string;
      apiKey: string;
      claim: string;
      evidence: string;
    };

  if (!apiKey?.trim()) {
    return Response.json({ error: "An API key is required." }, { status: 400 });
  }
  if (!claim?.trim()) {
    return Response.json({ error: "A claim is required." }, { status: 400 });
  }
  const def = DETERMINATIONS.find((d) => d.id === determination);
  if (!def) {
    return Response.json({ error: "Unknown determination." }, { status: 400 });
  }

  const modelId =
    model && PROVIDER_MODELS[provider]?.includes(model)
      ? model
      : PROVIDER_MODELS[provider][0];

  let languageModel;
  try {
    languageModel = buildModelById(provider, apiKey, modelId);
  } catch {
    return Response.json({ error: "Invalid API key format." }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model: languageModel,
      system: def.system,
      prompt: buildDeterminationPrompt(claim, evidence),
      // Determinism control: greedy decoding so the same input is as stable as
      // the provider allows. The experiment measures whether independent
      // lineages agree, not whether one model is internally noisy.
      temperature: 0,
      maxOutputTokens: 300,
    });
    return Response.json(parseCall(text));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Determination failed.";
    return Response.json({ error: msg }, { status: 502 });
  }
}
