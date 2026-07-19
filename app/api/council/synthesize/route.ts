import { generateText } from "ai";
import { buildModel } from "@/lib/models";
import { providerShort, type ProviderId } from "@/lib/providers";
import { readIndependence } from "@/lib/independence";

export const maxDuration = 60;

interface EvalResult {
  lens: string;
  label: string;
  provider: ProviderId;
  model?: string;
  score: number | null;
  text: string;
}

export async function POST(req: Request) {
  const { candidate, evaluations, synthProvider, apiKey } = (await req.json()) as {
    candidate: string;
    evaluations: EvalResult[];
    synthProvider: ProviderId;
    apiKey: string;
  };

  if (!apiKey?.trim()) {
    return Response.json({ error: "An API key is required." }, { status: 400 });
  }
  if (!evaluations?.length) {
    return Response.json({ error: "No evaluations to synthesize." }, { status: 400 });
  }

  const independence = readIndependence(
    evaluations.map((e) => ({ provider: e.provider, model: e.model }))
  );

  const scored = evaluations.filter((e) => typeof e.score === "number");
  const composite =
    scored.length > 0
      ? Math.round((scored.reduce((s, e) => s + (e.score as number), 0) / scored.length) * 10) / 10
      : null;

  const table = evaluations
    .map(
      (e) =>
        `- ${e.label} (${providerShort(e.provider)}): ${
          e.score == null ? "no score" : e.score + "/10"
        }`
    )
    .join("\n");

  const bodies = evaluations
    .map((e) => `### ${e.label} (${providerShort(e.provider)})\n${e.text.trim()}`)
    .join("\n\n");

  const system = `You are the chair of a public-goods evaluation council. You synthesize the evaluators' independent assessments into a short final report. You do not add your own opinion or invent facts; you read what the evaluators wrote and converge it.

The council logic is from the Octant Council Builder (Golem Foundation). This browser version carries one addition: an independence guard. Before trusting any agreement, you must weigh it by how independent the roster actually was.

ROSTER INDEPENDENCE: ${independence.gradeLabel} (${independence.distinctProviders} provider ${independence.distinctProviders === 1 ? "lineage" : "lineages"}, ${independence.distinctModels} distinct ${independence.distinctModels === 1 ? "model" : "models"}).
${independence.note}

Write the report in this structure, plainly, with no em dashes:
1. RECOMMENDATION: one of FUND / FUND WITH CONDITIONS / DON'T FUND / INSUFFICIENT DATA, then the composite score.
2. Executive summary (3-4 sentences).
3. Where the evaluators agreed, and how much that agreement is worth given the roster independence above. Weigh convergence by the independence: with a single lineage, treat agreement as suggestive and lean also on the evidence and the disagreements rather than on the count of agreeing votes; with cross-lineage agreement, it carries more. Do not overstate a single-lineage convergence as a settled floor, and do not dismiss it either.
4. Where they disagreed (this is the most informative part).
5. The single most important risk.
Keep it under 400 words.`;

  const prompt = `CANDIDATE: ${candidate.trim()}

SCORE TABLE:
${table}
Composite: ${composite == null ? "n/a" : composite + "/10"}

EVALUATIONS:
${bodies}`;

  let model;
  try {
    model = buildModel(synthProvider, apiKey);
  } catch {
    return Response.json({ error: "Invalid API key format." }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model,
      system,
      prompt,
      maxOutputTokens: 900,
    });
    return Response.json({ report: text, independence, composite });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Synthesis failed.";
    console.error("[synthesize] error:", err);
    return Response.json({ error: msg }, { status: 502 });
  }
}
