// The observer-independence experiment's units. Each determination is a single
// decidable question about a claim, answerable yes / no / insufficient from the
// evidence alone by an independent observer (PFDS Corollary 1). These are three
// of the Frame Language Frame-2-functioning checks, chosen because they are the
// most operationally decidable and because real proposals fail them. The test
// is whether genuinely independent model lineages reach the SAME call.

/**
 * A determination's outcome.
 *
 * `unparsed` is not a judgment. It records that a provider's reply could not be
 * read as a determination at all: wrong format, prose instead of a call, an
 * error surfaced as text. It exists because defaulting that case to
 * `insufficient` made a format failure indistinguishable from a genuine "the
 * evidence does not let me decide," which would quietly depress agreement and
 * present an empty reading as a real one. An unknown belongs in a named state,
 * not in a middle value.
 */
export type Call = "yes" | "no" | "insufficient" | "unparsed";

export interface Determination {
  id: string;
  label: string;
  // one-line plain statement of what a YES means, for the UI
  yesMeans: string;
  system: string;
}

const COMMON =
  "You are one independent observer making a single decidable determination about a claim, using the evidence provided and nothing else. Do not use outside knowledge about the project. Decide only what the evidence supports. Answer in exactly this format and nothing else:\nCALL: yes | no | insufficient\nQUOTE: the exact words from the claim or evidence you are judging, in quotation marks, or none\nWHY: one sentence.\nUse insufficient when the evidence does not let you decide either way. Do not hedge into a score; make the call.";

export const DETERMINATIONS: Determination[] = [
  {
    id: "metric-defined",
    label: "Metric defined",
    yesMeans: "the stated number or metric is operationally defined by the evidence",
    system:
      "Determination: does the evidence operationally define the stated metric or number, meaning it states what was measured and how, precisely enough that an independent party could in principle reproduce the measurement? YES if the metric is operationally defined. NO if a number or metric is stated but the evidence does not define what was measured or how (a precise-looking figure with no operational content). INSUFFICIENT if no metric is claimed or the evidence is silent.\n\n" +
      COMMON,
  },
  {
    id: "commitment-backed",
    label: "Commitment backed",
    yesMeans: "a stated commitment is backed by a specified mechanism, not just declared",
    system:
      "Determination: is a stated commitment backed by a specified structural mechanism, or is it only declared? YES if the evidence names a concrete mechanism, process, or structure that carries out the commitment. NO if the commitment is asserted (for example a value or intention stated) with no mechanism in the evidence that would enact it. INSUFFICIENT if no commitment is stated or the evidence is silent.\n\n" +
      COMMON,
  },
  {
    id: "goal-destination",
    label: "Goal has a destination",
    yesMeans: "a stated goal names a specific destination, not just a direction",
    system:
      "Determination: does the stated goal name a specific destination, meaning something that would count as having achieved it, or does it only name a direction of travel? YES if the evidence specifies what achieving the goal would concretely look like. NO if the goal names only a direction (for example improving, strengthening, advancing) with no stated end state. INSUFFICIENT if no goal is stated or the evidence is silent.\n\n" +
      COMMON,
  },
];

export function buildDeterminationPrompt(claim: string, evidence: string): string {
  const ev = evidence.trim() ? evidence.trim() : "(No separate evidence was pasted; judge only what the claim itself supports.)";
  return `CLAIM:\n${claim.trim()}\n\nEVIDENCE:\n${ev}`;
}

export function parseCall(text: string): { call: Call; quote: string; why: string } {
  const callMatch = text.match(/CALL:\s*(yes|no|insufficient)/i);
  const quoteMatch = text.match(/QUOTE:\s*([\s\S]*?)(?:\nWHY:|$)/i);
  const whyMatch = text.match(/WHY:\s*([\s\S]*?)$/i);

  // No CALL line means the reply was not a determination. Say so rather than
  // filing it as insufficient, which is a judgment this reply never made.
  if (!callMatch) {
    return {
      call: "unparsed",
      quote: "",
      why: text.trim()
        ? `No CALL line in the reply. Raw response: ${text.trim().slice(0, 300)}`
        : "Empty response from the provider.",
    };
  }

  const raw = callMatch[1].toLowerCase();
  const call: Call = raw === "yes" ? "yes" : raw === "no" ? "no" : "insufficient";
  return {
    call,
    quote: (quoteMatch?.[1] ?? "").trim(),
    why: (whyMatch?.[1] ?? "").trim(),
  };
}
