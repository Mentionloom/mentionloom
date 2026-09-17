# Design partner pack

## The ask, stated plainly

Three things, and no more:

1. Read and agree a set of 25–30 buyer questions.
2. Give read access to analytics (GA4 or equivalent) and, later, aggregated bot
   traffic from your CDN.
3. Ship at least two of the briefs we produce within 90 days.

In return: the measurement is free, and the first three partners keep founding
pricing for as long as they stay.

## What they get

- A baseline of AI Recommendation Share on their own questions, with a noise
  band and a control set, at a quality they cannot reproduce in a spreadsheet.
- A diagnosis of who is winning each question and which sources the answers cite.
- Content briefs specific enough to hand to a writer.
- A re-measurement after they publish, with the control comparison stated
  honestly — including when it shows nothing.

The reason to be explicit about the last point: a partner who has been told the
result might be null, and that you will say so, trusts the result when it is not.

## Outreach email

### Warm introduction

> Subject: the AI answer where you lose
>
> Hi [name] — [referrer] suggested I reach out.
>
> I asked ChatGPT and Perplexity your category's buying questions last week.
> [Competitor] came up first on most of them. [Their brand] appeared on
> [n] of the 25.
>
> I'm building Mentionloom to measure that properly and turn it into content
> briefs. I'm working with three teams in [vertical] before we open up.
>
> The ask: 25 minutes to check whether the questions I'm tracking are the ones
> that actually matter to your pipeline. No pitch on the call.
>
> [link to the methodology page]

### Cold

> Subject: [Competitor] is the AI answer, not you
>
> Hi [name] — I ran the questions buyers ask before choosing a [category] tool
> through four AI engines. [Competitor] was recommended on most of them.
> [Their brand] was on [n] of 25.
>
> I'm building the measurement and the fix: which questions you're losing, why,
> and what to publish. Three design partners, free measurement, and you keep
> founding pricing.
>
> Worth 25 minutes to see the list for your name?

Two rules for both versions. Name a real competitor and a real number, or do not
send it — a generic version of this email is indistinguishable from the fifty
others in their inbox. And never claim a number you did not measure.

## The one-pager

Six blocks, in this order, no more:

1. **The question**, in the buyer's own words, as asked to an engine.
2. **The answer**, quoted, with the competitor names visible.
3. **The gap** — this brand is absent while these three appear.
4. **Why** — the sources the answer cited, and what those pages say.
5. **The move** — one specific, publishable change.
6. **The re-measurement** — when it happens and what will be reported, including
   a null result.

Keep the sample workspace visible in this document. It is honest about being
illustrative, which is exactly the posture that makes the methodology credible.

## Pilot instrumentation

Sequence matters. Asking for log access in week one converts a warm partner into
a security review.

### Week 1 — Signal A only

- Confirm the question set and the competitor list in writing.
- Mark roughly 20% of questions as control. Tell the partner that some questions
  will not be acted on, without saying which.
- Baseline: 5 runs per question per engine, noise band reported alongside.
- No integrations. This week exists to produce an agreed, fair baseline.

### Week 2 — Signal B

- GA4 read access. Build an "AI sources" channel grouping from referrer patterns
  and UTMs: chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com,
  claude.ai, and the search surfaces that now answer directly.
- Report sessions and conversions, not just visits. The interesting number is
  whether AI-referred sessions convert differently, and the honest answer may be
  that the sample is too small to say yet.

### Later — Signal C, once trust exists

- Aggregated bot traffic from their CDN: GPTBot, ClaudeBot, PerplexityBot,
  Google-Extended and friends, by path.
- Use it to answer one question only: have the engines fetched the pages we
  changed? It is a diagnostic for Signal A, never a component of it.

## First call: five questions

Ask these, in this order, and write down the answers verbatim. They are worth
more than a metric this week.

1. Which buyer question would you most want to be the answer to?
2. When did you last check what an AI tool says about your category, and what
   did you see?
3. Who would act on a content brief, and how long would it take them to ship?
4. Which competitor appearing in an answer would worry you most?
5. If this showed your share moving three months from now, what decision would
   it change?

Question 3 is the qualifier. If nobody would ship a brief, this is not a design
partner — it is someone interested in the space, and interest does not produce a
before/after.
