"use client";

import { useState, useEffect } from "react";
import {
  PROVIDERS,
  detectProvider,
  providerShort,
  type ProviderId,
} from "@/lib/providers";
import { LENSES, type LensId } from "@/lib/lenses";

type Grade = "Weak" | "Moderate" | "Strong";
type Phase = "setup" | "running" | "synth" | "done";

interface Independence {
  grade: Grade;
  distinctProviders: number;
  providers: ProviderId[];
  fraction: number;
  note: string;
}

interface Lane {
  lens: LensId;
  label: string;
  provider: ProviderId;
  text: string;
  score: number | null;
  status: "running" | "done" | "error";
}

const STORAGE_KEY = "councilKeys";

function parseScore(text: string): number | null {
  const m = [...text.matchAll(/SCORE:\s*(\d+(?:\.\d+)?)\s*\/\s*10/gi)];
  if (!m.length) return null;
  const v = parseFloat(m[m.length - 1][1]);
  return isNaN(v) ? null : Math.max(0, Math.min(10, v));
}

function gradeFor(distinct: number): Grade {
  return distinct >= 3 ? "Strong" : distinct === 2 ? "Moderate" : "Weak";
}
function gradeClass(g: Grade) {
  return "grade-" + g.toLowerCase();
}
function fillClass(g: Grade) {
  return "fill-" + g.toLowerCase();
}

export default function CouncilPage() {
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [keyInput, setKeyInput] = useState("");
  const [selProvider, setSelProvider] = useState<ProviderId>("anthropic");
  const [candidate, setCandidate] = useState("");
  const [evidence, setEvidence] = useState("");
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [report, setReport] = useState("");
  const [composite, setComposite] = useState<number | null>(null);
  const [independence, setIndependence] = useState<Independence | null>(null);
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

  function updateLane(idx: number, patch: Partial<Lane>) {
    setLanes((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function runLane(
    lane: Lane,
    idx: number
  ): Promise<Lane | null> {
    try {
      const res = await fetch("/api/council/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lens: lane.lens,
          provider: lane.provider,
          apiKey: keys[lane.provider],
          candidate,
          evidence,
        }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        updateLane(idx, { status: "error", text: d.error || "Request failed." });
        return null;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        updateLane(idx, { text: acc });
      }
      const score = parseScore(acc);
      updateLane(idx, { status: "done", score, text: acc });
      return { ...lane, text: acc, score, status: "done" };
    } catch {
      updateLane(idx, { status: "error", text: "Network error." });
      return null;
    }
  }

  async function run() {
    setError("");
    if (activeProviders.length === 0) {
      setError("Add at least one provider key to run the council.");
      return;
    }
    if (!candidate.trim()) {
      setError("Describe the candidate to evaluate.");
      return;
    }
    setReport("");
    setComposite(null);
    setIndependence(null);

    const initial: Lane[] = LENSES.map((l, i) => ({
      lens: l.id,
      label: l.label,
      provider: activeProviders[i % activeProviders.length],
      text: "",
      score: null,
      status: "running" as const,
    }));
    setLanes(initial);
    setPhase("running");

    const results = await Promise.all(initial.map((l, i) => runLane(l, i)));
    const good = results.filter((r): r is Lane => r !== null);
    if (good.length === 0) {
      setError("Every evaluator failed. Check your keys and try again.");
      setPhase("setup");
      return;
    }

    setPhase("synth");
    const synthProvider: ProviderId = keys.anthropic
      ? "anthropic"
      : good[0].provider;
    try {
      const res = await fetch("/api/council/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate,
          synthProvider,
          apiKey: keys[synthProvider],
          evaluations: good.map((l) => ({
            lens: l.lens,
            label: l.label,
            provider: l.provider,
            score: l.score,
            text: l.text,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Synthesis failed.");
      } else {
        setReport(data.report);
        setComposite(data.composite);
        setIndependence(data.independence);
      }
    } catch {
      setError("Synthesis network error.");
    } finally {
      setPhase("done");
    }
  }

  // live gauge: before a run, reflects keys added; during/after, reflects the
  // providers actually assigned to lanes.
  const gaugeProviders =
    phase === "setup"
      ? activeProviders
      : Array.from(new Set(lanes.map((l) => l.provider)));
  const gaugeDistinct = new Set(gaugeProviders).size;
  const gaugeGrade = gradeFor(gaugeDistinct);
  const gaugeFraction = Math.min(1, gaugeDistinct / 3);

  const running = phase === "running" || phase === "synth";

  return (
    <main>
      <nav className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="https://precision.regischapman.com">
            <b>Precision</b> Council <span style={{ color: "var(--brass)" }}>for AI</span>
          </a>
          <div className="tabs">
            <a className="tab" href="https://precision.regischapman.com">Toolkit</a>
            <a className="tab" href="https://framelanguage.regischapman.com">Analyzer</a>
          </div>
        </div>
      </nav>
      <div className="wrap" style={{ padding: "44px 24px 80px" }}>
        {/* header */}
        <div style={{ marginBottom: 8 }} className="label">
          A demonstrator under the Precision Toolkit for AI
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 300, margin: "0 0 10px", display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          Precision Council for AI
          <span
            className="label"
            style={{ fontSize: 11, color: "var(--brass)", letterSpacing: "0.14em" }}
          >
            PC4AI
          </span>
        </h1>
        <p className="mut small" style={{ maxWidth: 720, margin: "0 0 4px" }}>
          A browser evaluation council. Independent evaluator agents score a
          candidate without seeing each other, then a chair converges them. It
          runs on your own provider keys, in this tab, and it grades how
          independent that convergence actually is: agreement is only worth as
          much as the independence behind it.
        </p>
        <p className="mut small" style={{ maxWidth: 720, margin: "0 0 28px" }}>
          Council logic from the{" "}
          <a
            href="https://github.com/golemfoundation/octant-council-builder"
            target="_blank"
            rel="noreferrer"
          >
            Octant Council Builder
          </a>{" "}
          (Golem Foundation, MIT). This browser version adds the
          independence-by-construction guard.
        </p>

        {/* key panel */}
        <div className="label" style={{ marginBottom: 10 }}>
          Provider keys
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {activeProviders.length === 0 && (
            <span className="mut small">No keys yet. Add one or more below.</span>
          )}
          {activeProviders.map((p) => (
            <span className="keychip" key={p}>
              <span className="dot" />
              {providerShort(p)}
              <span className="x" onClick={() => removeKey(p)}>
                ✕
              </span>
            </span>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <input
            type="password"
            value={keyInput}
            onChange={(e) => onKeyInputChange(e.target.value)}
            placeholder={
              PROVIDERS.find((p) => p.id === selProvider)?.placeholder ??
              "paste a key"
            }
            style={{ flex: "1 1 260px", minWidth: 200 }}
          />
          <select
            value={selProvider}
            onChange={(e) => setSelProvider(e.target.value as ProviderId)}
            style={{
              width: "auto",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--ink)",
              borderRadius: 4,
              padding: "10px 12px",
              fontFamily: "var(--mono)",
              fontSize: 12,
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button className="btn" onClick={addKey}>
            Add key
          </button>
        </div>
        <p className="mut" style={{ fontSize: 11, maxWidth: 720, marginBottom: 24 }}>
          Keys are kept only in this browser tab and cleared when you close it.
          They are sent straight to the provider you name and are never logged or
          stored server-side. You pay your own usage. Add keys from more than one
          provider to raise the independence of the result.
        </p>

        {/* independence gauge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 26,
            maxWidth: 720,
          }}
        >
          <span className="label" style={{ minWidth: 90 }}>
            Independence
          </span>
          <div className="gauge-track" style={{ flex: 1 }}>
            <div
              className={"gauge-fill " + fillClass(gaugeGrade)}
              style={{ width: Math.max(6, gaugeFraction * 100) + "%" }}
            />
          </div>
          <span className={"small " + gradeClass(gaugeGrade)} style={{ minWidth: 150 }}>
            {gaugeGrade} · {gaugeDistinct}{" "}
            {gaugeDistinct === 1 ? "lineage" : "lineages"}
          </span>
        </div>

        {/* inputs */}
        <div className="label" style={{ marginBottom: 8 }}>
          Candidate
        </div>
        <textarea
          value={candidate}
          onChange={(e) => setCandidate(e.target.value)}
          placeholder="Name and describe the project or candidate to evaluate."
          rows={3}
          style={{ marginBottom: 16 }}
          disabled={running}
        />
        <div className="label" style={{ marginBottom: 8 }}>
          Evidence <span style={{ textTransform: "none", letterSpacing: 0 }}>(shared by all evaluators)</span>
        </div>
        <textarea
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Paste the evidence the council should judge from: repo stats, funding history, docs, on-chain data, links summarized. All evaluators read this same text."
          rows={6}
          style={{ marginBottom: 18 }}
          disabled={running}
        />

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            className="btn primary"
            onClick={run}
            disabled={running || activeProviders.length === 0 || !candidate.trim()}
          >
            {phase === "running"
              ? "Council running…"
              : phase === "synth"
              ? "Synthesizing…"
              : "Convene the council"}
          </button>
          {error && (
            <span className="small" style={{ color: "var(--red)" }}>
              {error}
            </span>
          )}
        </div>

        {/* lanes */}
        {lanes.length > 0 && (
          <>
            <hr className="rule" />
            <div className="label" style={{ marginBottom: 12 }}>
              Evaluators · streaming live, blind to each other
            </div>
            <div className="lanes">
              {lanes.map((l, i) => (
                <div
                  key={l.lens}
                  className={"lane" + (l.status === "running" ? " running" : "")}
                >
                  <div className="lane-head">
                    <span className="lane-lens">{l.label}</span>
                    <span className="lane-provider">{providerShort(l.provider)}</span>
                  </div>
                  <div className="lane-body">
                    {l.text || (
                      <span className="mut">
                        {l.status === "running" ? "reading evidence…" : ""}
                      </span>
                    )}
                    {l.status === "running" && <span className="blink"> ▋</span>}
                  </div>
                  <div className="lane-foot">
                    <span
                      className="lane-score"
                      style={{
                        color:
                          l.score == null
                            ? "var(--faint)"
                            : l.score >= 7
                            ? "var(--rich-c)"
                            : l.score >= 4
                            ? "var(--cool)"
                            : "var(--warm)",
                      }}
                    >
                      {l.score == null ? "·" : l.score + "/10"}
                    </span>
                    <span className="lane-status">
                      {l.status === "running"
                        ? "scoring"
                        : l.status === "error"
                        ? "failed"
                        : "filed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* floor + report */}
        {phase === "done" && independence && (
          <>
            <hr className="rule" />
            <div className="label" style={{ marginBottom: 12 }}>
              The verified floor
            </div>
            <Floor lanes={lanes} independence={independence} composite={composite} />

            {report && (
              <>
                <hr className="rule" />
                <div className="label" style={{ marginBottom: 12 }}>
                  Council report
                </div>
                <div className="report">{report}</div>
              </>
            )}

            <p className="mut" style={{ fontSize: 11, marginTop: 28 }}>
              Council logic from the Octant Council Builder (Golem Foundation,
              MIT). The independence guard and this browser implementation are a
              Precision Toolkit for AI demonstrator. The convergence is a floor,
              not a verdict: what the candidate is worth is your call.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Floor({
  lanes,
  independence,
  composite,
}: {
  lanes: Lane[];
  independence: Independence;
  composite: number | null;
}) {
  const scored = lanes.filter((l) => l.score != null);
  if (scored.length === 0) return null;
  const scores = scored.map((l) => l.score as number);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const pct = (s: number) => ((s - 1) / 9) * 100;
  const bandColor =
    independence.grade === "Strong"
      ? "var(--rich-c)"
      : independence.grade === "Moderate"
      ? "var(--cool)"
      : "var(--warm)";

  return (
    <div className="floor">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="small mut">
          Composite{" "}
          <strong style={{ color: "var(--ink)" }}>
            {composite == null ? "n/a" : composite + "/10"}
          </strong>
        </span>
        <span className={"small " + gradeClass(independence.grade)}>
          independence: {independence.grade} · {independence.distinctProviders}{" "}
          {independence.distinctProviders === 1 ? "lineage" : "lineages"} · shared evidence
        </span>
      </div>

      <div className="floor-scale">
        {/* contested band from min to max */}
        <div
          className="floor-band"
          style={{
            left: pct(min) + "%",
            width: Math.max(1, pct(max) - pct(min)) + "%",
            background: "color-mix(in srgb, " + bandColor + " 12%, transparent)",
            borderColor: bandColor,
          }}
        />
        {/* ticks 1..10 */}
        {[1, 3, 5, 7, 9, 10].map((t) => (
          <div key={t} className="floor-tick" style={{ left: pct(t) + "%", background: "var(--hair)" }}>
            <span className="cap">{t}</span>
          </div>
        ))}
        {/* evaluator dots */}
        {scored.map((l) => (
          <div
            key={l.lens}
            className="floor-dot"
            title={l.label + ": " + l.score + "/10 (" + providerShort(l.provider) + ")"}
            style={{
              left: pct(l.score as number) + "%",
              background: bandColor,
              boxShadow: "0 0 0 3px var(--surface-2)",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
        {scored.map((l) => (
          <span key={l.lens} className="small mut">
            <span style={{ color: bandColor }}>●</span> {l.label} {l.score}/10{" "}
            <span style={{ color: "var(--faint)" }}>({providerShort(l.provider)})</span>
          </span>
        ))}
      </div>

      <p className="mut" style={{ fontSize: 11, marginTop: 16, marginBottom: 0 }}>
        {independence.note}
      </p>
    </div>
  );
}
