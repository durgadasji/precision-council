# Precision Council for AI (PC4AI)

A browser evaluation council. Independent evaluator agents score a candidate without seeing each other, then a chair converges them. It runs on the user's own provider keys, in their browser tab, and it grades how independent that convergence actually was, because agreement is only worth as much as the independence behind it.

A demonstrator under the Precision Toolkit for AI (PT4AI). It is the toolkit's three-plate method run at scale: independent reads ground against each other, the convergence is the verified floor.

## What it is and is not

The council logic is from the [Octant Council Builder](https://github.com/golemfoundation/octant-council-builder) (Golem Foundation, MIT), a Claude Code plugin. That is the heavyweight instrument: real data-gathering agents, live team orchestration, Strong independence with cross-provider and partitioned evidence. It needs Claude Code and setup.

This is the easy on-ramp. No Claude Code, no install. It reimplements the council's shape (independent evaluators, then synthesis) in the browser against the AI SDK, on keys the user supplies. It carries one thing the base plugin leaves optional: the independence guard.

- Evidence is pasted, not gathered.
- Evaluators do not talk to each other (linear, which is simpler and more independent).
- One candidate at a time.
- The five lenses (technical, community, financial, impact, skeptic) are adapted from the OCB agents.

## The independence guard

The five evaluators are assigned across whatever providers the user supplies keys for. Independence scales with distinct model lineages: one provider is Weak (one lineage in several costumes), two is Moderate, three or more is Strong. The chair weighs convergence by that grade and never presents a same-lineage agreement as a verified floor. Evidence is always shared here, a shared blind spot, and that is stated at every grade.

## Keys and cost

Keys live only in the browser tab's session storage, are sent straight to the named provider, and are never logged or stored server-side. The user pays their own usage. Supported providers: Anthropic, Google, xAI, OpenAI, Mistral (Vercel AI SDK).

## Run

```
npm install
npm run dev
```

Default models per provider are cheap and fast (see `lib/models.ts`); the value is provider diversity, not peak capability in any one lane.
