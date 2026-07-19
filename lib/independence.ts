import type { ProviderId } from "./providers";

export type GradeKey = "single" | "cross" | "broad";

export interface IndependenceReading {
  gradeKey: GradeKey;
  gradeLabel: string;
  distinctProviders: number;
  distinctModels: number;
  providers: ProviderId[];
  // 0..1, drives the gauge fill
  fraction: number;
  note: string;
}

const SHARED_EVIDENCE =
  "All evaluators read the same pasted evidence, a shared blind spot: if that evidence is wrong or incomplete, every evaluator inherits the gap and their agreement cannot catch it.";

// Independence is a dial, not a grade you pass or fail. It describes how much
// construction diversity the roster actually had and points at how to widen it.
// A single provider key already spreads the evaluators across that provider's
// models (one lineage, several models); adding a second provider crosses
// genuinely different model lineages, which is stronger. Nothing here reads as
// failure; the lower rungs are honest descriptions with an upgrade path.
export function readIndependence(
  pairs: { provider: ProviderId; model?: string }[]
): IndependenceReading {
  const providers = Array.from(new Set(pairs.map((p) => p.provider)));
  const models = Array.from(new Set(pairs.map((p) => p.model ?? p.provider)));
  const nP = providers.length;
  const nM = models.length;

  let gradeKey: GradeKey;
  let gradeLabel: string;
  let fraction: number;
  if (nP >= 3) {
    gradeKey = "broad";
    gradeLabel = "Broad cross-lineage";
    fraction = 1;
  } else if (nP === 2) {
    gradeKey = "cross";
    gradeLabel = "Cross-lineage";
    fraction = 0.75;
  } else {
    gradeKey = "single";
    gradeLabel = "Single lineage";
    fraction = 0.45;
  }

  let note: string;
  if (gradeKey === "single") {
    note =
      `The evaluators ran on one provider's models (${nM} distinct ${nM === 1 ? "model" : "models"}, one training lineage). ` +
      `Their convergence is a real signal, but a same-lineage one: models from one provider can share a blind spot no spread of sizes will surface. Add a key from another provider to grind across genuinely different lineages and strengthen it. ` +
      SHARED_EVIDENCE;
  } else if (gradeKey === "cross") {
    note =
      `The evaluators spanned ${nP} providers (${nM} models), so there is real cross-lineage diversity. Treat convergence as solid but not the ceiling; a third lineage widens it further. ` +
      SHARED_EVIDENCE;
  } else {
    note =
      `The evaluators spanned ${nP} providers and ${nM} models, genuinely different lineages, the strongest independence this browser version produces. It is still not absolute: ` +
      SHARED_EVIDENCE;
  }

  return { gradeKey, gradeLabel, distinctProviders: nP, distinctModels: nM, providers, fraction, note };
}
