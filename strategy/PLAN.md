# Mentionloom: 90-day plan, revised

Source: the strategic objective shared on 2026-09-16. This revision keeps the
sequencing intent and changes four things that would otherwise cost the quarter.

## What the original plan gets right

The order is correct: lock a thesis, define the measurement before recruiting,
recruit a small number of partners, then productize. The tri-signal idea and the
"answer → action brief" loop are the two assets worth building around. Nothing
here is wasted work.

## Four things that will break it

### 1. The day-90 goal measures something the clock cannot deliver

"3–5 design partners with visible recommendation shifts" asks a 90-day window to
prove causality that the window cannot support. Answer engines are
non-deterministic, they change for reasons unrelated to your partners' content,
and a content change compounds over months rather than weeks. A single partner
with a number that moved and no control is an anecdote, and it is the kind of
anecdote an investor will pull apart in one question.

Fix: hold back a control set of questions you never act on, roughly 20% of each
partner's set. Report the treated set against it. If the treated set does not
move further than the control, say so and keep going. The control set is what
turns a story into evidence, and it costs nothing to build on day one.

### 2. Recruitment is the long pole and it starts in week 3

The plan spends three weeks on methodology before talking to anyone. Outreach
has the longest lead time of anything in the plan, and the conversations
themselves sharpen the metric faster than internal refinement does. A head of
growth will tell you in twenty minutes which questions they actually lose deals
on.

Fix: start outreach in week 1, before the metric is finished. Use the first
three conversations to test the question bank, not to sell.

### 3. A weighted composite makes the flagship metric indefensible

The plan proposes weighting answers, referrals and crawler traffic into one
number. Bot visits are not recommendations, and referrals are an outcome rather
than a visibility measure. Folding three unvalidated signals into one score
produces a number nobody can explain when it moves, which is the opposite of the
transparency the plan is reaching for.

Fix: one signal is the metric, one is the outcome, one is a diagnostic. See
`METRIC.md`.

### 4. Willingness to pay is tested at step 9, which is too late

Pricing is treated as a late packaging exercise. It is the fastest available
test of whether the problem is worth money. Free design partners are polite
about value; they are honest about invoices.

Fix: ask for a paid pilot around day 45, at any price above zero. A small
invoice is a better signal than a satisfied weekly meeting.

## A methodology landmine the plan does not mention

Probing engines through their APIs does not measure what buyers see. A ChatGPT
API call without browsing returns different recommendations from the consumer
product with search enabled, and the same is true for several other engines.
If a partner checks the consumer app and sees different brands from your report,
your credibility is gone in that meeting and it does not come back.

This does not mean the API route is unusable. It means the report has to say
which surface it measured, and the methodology has to include a divergence check
against the consumer surface. Both are in `METRIC.md`.

## Revised sequence

| Window | Focus | Exit gate |
| --- | --- | --- |
| Days 0–5 | Thesis, metric spec with a noise band, 25 questions, outreach live | Metric is written down and reproducible by someone else |
| Days 5–20 | Probing prototype on 2 engines, 5 recorded partner conversations | Prototype produces a number with a variance estimate |
| Days 20–45 | First partner live on Signal A, baseline + control set, first briefs shipped | A baseline exists that the partner agrees is fair |
| Days 45–70 | First before/after with control, first paid pilot ask, methodology published | Either a movement beyond the noise band, or a clear null result |
| Days 70–90 | Second and third partner, positioning doc, investable narrative | One paying partner, or a deliberate repositioning |

The two decision points that matter:

- **Day 70, no paying partner.** The monitoring product is not the business yet.
  Reposition to a done-with-you service — briefs and content work priced as
  engagements — and use it to fund the product.
- **Day 70, no movement beyond the noise band in the treated set versus control.**
  The wedge is the brief and the work, not the score. Lead with that instead of
  the metric.

## What I would cut or defer

- **Crawler signal as a metric input.** Keep it as a diagnostic, never as a
  component of the headline number.
- **Three pricing tiers.** One price, one test. Tiers are a packaging exercise
  that makes sense after there is demand to segment.
- **A long-form founder's guide.** A public methodology page does the same work
  in less time, doubles as objection handling in sales, and is the asset a
  technical buyer actually reads before a call.

## The risk to name out loud

AI brand monitoring is already a funded category. The plan names BrandRank;
before writing the positioning doc, spend an hour verifying the current field
(Profound, Otterly.ai, Peec AI and Scrunch are worth checking and may have moved
since). Measurement is becoming a feature rather than a moat.

The defensible position is not "we can measure the number." It is "we can move
the number, and here is the evidence that we did, on questions that carry
revenue." That is why the control set and the before/after are not academic
details in this plan — they are the product.

