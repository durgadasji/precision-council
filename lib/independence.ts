import type { ProviderId } from "./providers";

export type Grade = "Weak" | "Moderate" | "Strong";

export interface IndependenceReading {
  grade: Grade;
  distinctProviders: number;
  providers: ProviderId[];
  // 0..1, drives the gauge fill
  fraction: number;
  note: string;
}

// Independence scales with how many distinct model lineages actually scored.
// One provider is one lineage in several costumes (Weak), two is Moderate,
// three or more is Strong. Evidence is always shared in this browser version,
// which is a shared blind spot, so that limitation is stated at every grade.
export function readIndependence(providers: ProviderId[]): IndependenceReading {
  const distinct = Array.from(new Set(providers));
  const n = distinct.length;

  let grade: Grade;
  if (n >= 3) grade = "Strong";
  else if (n === 2) grade = "Moderate";
  else grade = "Weak";

  const fraction = Math.min(1, n / 3);

  const sharedEvidence =
    "All evaluators read the same pasted evidence, a shared blind spot: if that evidence is wrong or incomplete, every evaluator inherits the gap and their agreement cannot catch it.";

  let note: string;
  if (grade === "Weak") {
    note =
      `Only one model lineage scored, so the evaluators differ by prompt but not by construction. Their agreement is close to one model restated five times and is not a verified floor. ` +
      sharedEvidence;
  } else if (grade === "Moderate") {
    note =
      `Two distinct model lineages scored, so there is real construction diversity but a narrow base. Treat convergence as suggestive, not settled. ` +
      sharedEvidence;
  } else {
    note =
      `Three or more distinct model lineages scored, so convergence here reflects agreement across genuinely different constructions, the strongest signal this browser version can produce. It is still not absolute: ` +
      sharedEvidence;
  }

  return { grade, distinctProviders: n, providers: distinct, fraction, note };
}
