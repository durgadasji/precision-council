import { streamText } from "ai";
import { buildModel } from "@/lib/models";
import { type ProviderId } from "@/lib/providers";
import { LENSES, buildEvaluatorPrompt, type LensId } from "@/lib/lenses";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { lens, provider, apiKey, candidate, evidence } = (await req.json()) as {
    lens: LensId;
    provider: ProviderId;
    apiKey: string;
    candidate: string;
    evidence: string;
  };

  if (!apiKey?.trim()) {
    return Response.json({ error: "An API key is required." }, { status: 400 });
  }
  if (!candidate?.trim()) {
    return Response.json({ error: "A candidate is required." }, { status: 400 });
  }
  const lensDef = LENSES.find((l) => l.id === lens);
  if (!lensDef) {
    return Response.json({ error: "Unknown lens." }, { status: 400 });
  }

  let model;
  try {
    model = buildModel(provider, apiKey);
  } catch {
    return Response.json({ error: "Invalid API key format." }, { status: 400 });
  }

  const result = streamText({
    model,
    system: lensDef.system,
    prompt: buildEvaluatorPrompt(candidate, evidence),
    maxOutputTokens: 700,
    onError: ({ error }) => {
      console.error(`[evaluate:${lens}] streamText error:`, error);
    },
  });

  return result.toTextStreamResponse();
}
