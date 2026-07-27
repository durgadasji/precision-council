"use client";

import { useState, useEffect } from "react";
import {
  PROVIDERS,
  PROVIDER_MODELS,
  detectProvider,
  providerShort,
  type ProviderId,
} from "@/lib/providers";
import { DETERMINATIONS, type Call } from "@/lib/determinations";

type Phase = "setup" | "running" | "done";
interface Cell {
  status: "running" | "done" | "error";
  call?: Call;
  quote?: string;
  why?: string;
}
type Grid = Record<string, Record<string, Cell>>; // det.id -> provider -> cell

const STORAGE_KEY = "councilKeys";

function callColor(c?: Call) {
  if (c === "unparsed") return "var(--warm)";
  return c === "yes" ? "var(--rich-c)" : c === "no" ? "var(--warm)" : "var(--faint)";
}
function callLabel(c?: Call) {
  if (c === "unparsed") return "unread";
  return c === "yes" ? "yes" : c === "no" ? "no" : c === "insufficient" ? "n/e" : "";
}

/**
 * Build a pre-filled issue for a reply that could not be read.
 *
 * Only a handful of providers have been run against these determinations. A
 * model that answers in an unexpected shape is the likeliest failure and the
 * one a user hits first, so the readout turns it into a report rather than
 * leaving the person to describe it from memory. The raw text is truncated and
 * carries no key.
 */
function reportUrl(detId: string, provider: string, model: string | undefined, why: string) {
  const title = `Unreadable reply: ${provider}${model ? ` (${model})` : ""} on ${detId}`;
  const body = [
    "The observer-independence page could not read this provider's reply as a determination.",
    "",
    `Determination: ${detId}`,
    `Provider: ${provider}`,
    `Model: ${model ?? "default"}`,
    "",
    "What came back:",
    "",
    "```",
    why.slice(0, 1000),
    "```",
    "",
    "Anything else worth knowing:",
  ].join("\n");
  return `https://github.com/durgadasji/precision-council/issues/new?title=${encodeURIComponent(
    title,
  )}&body=${encodeURIComponent(body)}`;
}

function agreementFor(row: Record<string, Cell> | undefined) {
  const done = Object.values(row ?? {}).filter((c) => c.status === "done" && c.call);
  // A reply that could not be read is not a participant in an agreement.
  // Counting it would let two unreadable replies report as unanimous, which is
  // the failure this state was added to prevent, inverted.
  const unread = done.filter((c) => c.call === "unparsed").length;
  const calls = done
    .filter((c) => c.call !== "unparsed")
    .map((c) => c.call as Call);
  const suffix = unread > 0 ? ` (${unread} unread)` : "";
  if (calls.length < 2)
    return {
      kind: "pending" as const,
      text: unread > 0 ? `not enough readable replies${suffix}` : "",
    };
  const counts: Record<string, number> = {};
  calls.forEach((c) => (counts[c] = (counts[c] ?? 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (top.length === 1)
    return {
      kind: "unanimous" as const,
      text: `all ${calls.length} agreed: ${top[0][0]}${suffix}`,
    };
  const breakdown = top.map(([k, n]) => `${n} ${k}`).join(", ");
  return { kind: "split" as const, text: `split: ${breakdown}${suffix}` };
}

export default function ObservePage() {
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [keyInput, setKeyInput] = useState("");
  const [selProvider, setSelProvider] = useState<ProviderId>("anthropic");
  const [claim, setClaim] = useState("");
  const [evidence, setEvidence] = useState("");
  const [grid, setGrid] = useState<Grid>({});
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setKeys(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  function persist(next: Partial<Record<ProviderId, string>>) {
    setKeys(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  const activeProviders = (Object.keys(keys) as ProviderId[]).filter(
    (p) => (keys[p] ?? "").trim().length > 0
  );
  function onKeyInputChange(v: string) {
    setKeyInput(v);
    const d = detectProvider(v);
    if (d) setSelProvider(d);
  }
  function addKey() {
    const k = keyInput.trim();
    if (!k) return;
    persist({ ...keys, [selProvider]: k });
    setKeyInput("");
    setError("");
  }
  function removeKey(p: ProviderId) {
    const next = { ...keys };
    delete next[p];
    persist(next);
  }

  function setCell(detId: string, provider: string, patch: Cell) {
    setGrid((prev) => ({
      ...prev,
      [detId]: { ...(prev[detId] ?? {}), [provider]: patch },
    }));
  }

  async function run() {
    setError("");
    if (activeProviders.length === 0) {
      setError("Add at least one provider key. Two or more different providers is what makes this a real test.");
      return;
    }
    if (!claim.trim()) {
      setError("Paste the claim to test.");
      return;
    }
    // one model per provider: each provider is one independent observer
    const observers = activeProviders.map((p) => ({ provider: p, model: PROVIDER_MODELS[p][0] }));
    const fresh: Grid = {};
    DETERMINATIONS.forEach((d) => {
      fresh[d.id] = {};
      observers.forEach((o) => (fresh[d.id][o.provider] = { status: "running" }));
    });
    setGrid(fresh);
    setPhase("running");

    const jobs: Promise<void>[] = [];
    for (const d of DETERMINATIONS) {
      for (const o of observers) {
        jobs.push(
          (async () => {
            try {
              const res = await fetch("/api/council/determine", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  determination: d.id,
                  provider: o.provider,
                  model: o.model,
                  apiKey: keys[o.provider],
                  claim,
                  evidence,
                }),
              });
              const data = await res.json();
              if (!res.ok || data.error) {
                setCell(d.id, o.provider, { status: "error", why: data.error });
              } else {
                setCell(d.id, o.provider, { status: "done", call: data.call, quote: data.quote, why: data.why });
              }
            } catch {
              setCell(d.id, o.provider, { status: "error", why: "network error" });
            }
          })()
        );
      }
    }
    await Promise.all(jobs);
    setPhase("done");
  }

  const running = phase === "running";
  const observers = activeProviders;

  // headline: of the determinations, how many were unanimous across observers
  const rows = DETERMINATIONS.map((d) => ({ d, agree: agreementFor(grid[d.id]) }));
  const unanimous = rows.filter((r) => r.agree.kind === "unanimous").length;
  const decided = rows.filter((r) => r.agree.kind !== "pending").length;

  return (
    <main>
      <nav className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="https://precision.regischapman.com">
            <b>Precision</b> Council <span style={{ color: "var(--brass)" }}>for AI</span>
          </a>
          <div className="tabs">
            <a className="tab" href="/">Council</a>
            <a className="tab" href="https://precision.regischapman.com">Toolkit</a>
          </div>
        </div>
      </nav>
      <div className="wrap" style={{ padding: "44px 24px 80px" }}>
        <div style={{ marginBottom: 8 }} className="label">
          Precision Council for AI · observer-independence test
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 300, margin: "0 0 10px" }}>
          Do independent readers reach the same reading?
        </h1>
        <p className="mut small" style={{ maxWidth: 720, margin: "0 0 6px" }}>
          The whole question is whether meaning can be measured in a shared way. This runs the same evidence-anchored yes or no checks past several AIs from different makers, separately, and shows whether they reach the same call. Agreement across genuinely different lineages is the reading being observer-independent rather than one model&apos;s opinion.
        </p>
        <p className="mut small" style={{ maxWidth: 720, margin: "0 0 28px" }}>
          It only tests that if you add keys from two or more different providers. One provider only measures a model against its own cousins.
        </p>

        {/* keys */}
        <div className="label" style={{ marginBottom: 10 }}>Provider keys</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {activeProviders.length === 0 && <span className="mut small">No keys yet.</span>}
          {activeProviders.map((p) => (
            <span className="keychip" key={p}>
              <span className="dot" />
              {providerShort(p)}
              <span className="x" onClick={() => removeKey(p)}>✕</span>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => onKeyInputChange(e.target.value)}
            placeholder={PROVIDERS.find((p) => p.id === selProvider)?.placeholder ?? "paste a key"}
            style={{ flex: "1 1 260px", minWidth: 200 }}
          />
          <select
            value={selProvider}
            onChange={(e) => setSelProvider(e.target.value as ProviderId)}
            style={{ width: "auto", background: "var(--bg2)", border: "1px solid var(--hair)", color: "var(--ink)", borderRadius: 4, padding: "11px 13px", fontFamily: "var(--mono)", fontSize: 12 }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button className="btn" onClick={addKey}>Add key</button>
        </div>

        {/* inputs */}
        <div className="label" style={{ marginBottom: 8 }}>Claim</div>
        <textarea value={claim} onChange={(e) => setClaim(e.target.value)} rows={2} disabled={running}
          placeholder="Paste the claim to test, e.g. a sentence from a proposal." style={{ marginBottom: 16 }} />
        <div className="label" style={{ marginBottom: 8 }}>Evidence <span style={{ textTransform: "none", letterSpacing: 0 }}>(what the checks judge against)</span></div>
        <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={4} disabled={running}
          placeholder="Paste the supporting evidence the readers should judge from. All observers see this same text." style={{ marginBottom: 18 }} />

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn primary" onClick={run} disabled={running || activeProviders.length === 0 || !claim.trim()}>
            {running ? "Reading…" : "Run the checks"}
          </button>
          {error && <span className="small" style={{ color: "var(--red)" }}>{error}</span>}
        </div>

        {/* grid */}
        {Object.keys(grid).length > 0 && (
          <>
            <hr className="rule" />
            {phase === "done" && (
              <p className="small" style={{ marginBottom: 18 }}>
                <span className={unanimous === decided && decided > 0 ? "grade-broad" : "grade-cross"}>
                  {unanimous} of {decided} checks were unanimous across {observers.length}{" "}
                  {observers.length === 1 ? "reader" : "independent readers"}.
                </span>{" "}
                <span className="mut">
                  {observers.length < 2
                    ? "Add a second provider to test agreement across genuinely different lineages."
                    : "Unanimous checks are readings that reproduced across makers; split checks are frame-dependent."}
                </span>
              </p>
            )}
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--hair)" }}>
                      <span className="label">Check</span>
                    </th>
                    {observers.map((p) => (
                      <th key={p} style={{ padding: "8px 10px", borderBottom: "1px solid var(--hair)" }}>
                        <span className="lane-provider">{providerShort(p)}</span>
                      </th>
                    ))}
                    <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--hair)" }}>
                      <span className="label">Agreement</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ d, agree }) => (
                    <tr key={d.id}>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid var(--hair2)", verticalAlign: "top", maxWidth: 260 }}>
                        <div style={{ fontFamily: "var(--serif)", fontSize: 15 }}>{d.label}</div>
                        <div className="mut" style={{ fontSize: 11, marginTop: 3 }}>yes: {d.yesMeans}</div>
                      </td>
                      {observers.map((p) => {
                        const cell = grid[d.id]?.[p];
                        return (
                          <td key={p} style={{ padding: "12px 10px", borderBottom: "1px solid var(--hair2)", textAlign: "center", verticalAlign: "top" }}>
                            {!cell || cell.status === "running" ? (
                              <span className="mut blink">·</span>
                            ) : cell.status === "error" ? (
                              <span title={cell.why} style={{ color: "var(--faint)", fontSize: 11 }}>err</span>
                            ) : cell.call === "unparsed" ? (
                              <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                                <span
                                  title={cell.why ?? ""}
                                  style={{ color: callColor(cell.call), fontWeight: 700, fontSize: 13, cursor: "help" }}
                                >
                                  {callLabel(cell.call)}
                                </span>
                                <a
                                  href={reportUrl(d.id, p, undefined, cell.why ?? "")}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="small mut"
                                  style={{ fontSize: 10, textDecoration: "underline" }}
                                >
                                  report
                                </a>
                              </span>
                            ) : (
                              <span
                                title={(cell.quote ? cell.quote + "\n\n" : "") + (cell.why ?? "")}
                                style={{ color: callColor(cell.call), fontWeight: 700, fontSize: 13, cursor: "help" }}
                              >
                                {callLabel(cell.call)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid var(--hair2)", verticalAlign: "top" }}>
                        <span
                          className={"small " + (agree.kind === "unanimous" ? "grade-broad" : agree.kind === "split" ? "grade-cross" : "mut")}
                        >
                          {agree.kind === "pending" ? "…" : agree.text}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mut" style={{ fontSize: 11, marginTop: 16 }}>
              n/e means not enough evidence to decide, which is itself an honest call. Hover a cell for the quote it judged and its one-line reason. Runs at temperature zero; the readings are the models&apos; own, not scored by this page.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
