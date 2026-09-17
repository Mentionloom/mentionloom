# Thesis and flagship metric

## One-sentence promise

Mentionloom shows how often AI answer engines recommend you instead of your
competitors on the buyer questions that carry revenue, why you are losing the
rest, and what to change.

The first half is measurement. The second half is the reason anyone pays. Keep
both halves in the sentence; a promise that stops at "how often" describes a
dashboard, and dashboards are the crowded part of this category.

## The metric: AI Recommendation Share

For one brand, across a defined question set and engine set, over a window:

```
AI Recommendation Share = answers where the brand is shortlisted or recommended
                          ---------------------------------------------------
                                      total sampled answers
```

Every sampled answer resolves to exactly one state per brand:

| State | Definition | Counts toward the metric |
| --- | --- | --- |
| Absent | The brand does not appear and no competitor is named | No |
| Mentioned | The brand's name appears, in any context, including a dismissal | No |
| Shortlisted | The brand is named as one of several viable options | Yes |
| Recommended | The brand is endorsed directly, named first, or given as the primary answer | Yes |

The gap between Mentioned and Shortlisted is the point of the product. Monitoring
tools stop at the first row. Mention rate flatters; recommendation share is what
a partner can take to their board.

Also report, as a second headline number:

```
Lost Recommendation Share = answers where a competitor is shortlisted or
                            recommended and the brand is absent or merely mentioned
                            --------------------------------------------------------
                                              total sampled answers
```

This is the number that sells. It is concrete, it is uncomfortable, and it maps
directly onto the briefs that follow.

### Worked example (illustrative, matching the sample workspace)

Acme, 25 questions, 5 engines, 5 runs per question per engine, one week:

- 125 question-engine pairs, 625 sampled answers.
- 284 answers recommend or shortlist Acme.
- Recommendation Share: 45.4%.
- 322 answers recommend a competitor while Acme is absent or merely mentioned.
- Lost Recommendation Share: 51.5%.
- Run-to-run variance on this set puts the noise band at roughly ±2.5 points, so
  the honest statement is "45.4%, ±2.5."

That band is the part most competitors omit and the part that keeps you credible
in a room with a skeptical operator.

## What the metric deliberately excludes

Crawler and bot traffic does not enter the number. A bot fetching a page is not a
recommendation, and a composite that mixes the two cannot be explained when it
moves. Referral traffic does not enter the number either; it is an outcome, and
mixing outcomes into a visibility measure hides which one changed.

Both are still reported. They sit next to the metric, clearly labelled, as
supporting evidence.

## Measurement rules

These are the non-negotiables. Every one of them exists because omitting it
produces a number that collapses under a single question.

1. **Five runs per question per engine per cycle.** One run is an anecdote. Five
   gives a variance estimate and makes the noise band honest. If cost forces a
   reduction, run three and widen the band rather than pretending to precision.
2. **Publish the band, not the point.** "45.4% (±2.5)" is a different claim from
   "45.4%."
3. **Hold back a control set.** Roughly 20% of questions receive no intervention
   for the duration of the engagement. Movements in the treated set are compared
   against the control. Without this, no before/after claim is defensible.
4. **Segment by intent stage.** Discovery, comparison and decision move at
   different speeds, and decision questions are worth more. A blended number
   hides the part that matters.
5. **Declare the surface.** Every report states whether it measured an API
   surface or a consumer surface, and which model, region and date. Never imply
   the API surface is identical to the consumer app.
6. **Run a divergence check monthly.** Re-run a sample of the same prompts
   directly in the consumer products and record the difference. If divergence is
   large, either measure the consumer surface or label the product an
   API-based estimate, and say which.
7. **Record the raw answer.** Every scored answer is retained with engine,
   model, timestamp, question, raw text and cited URLs. Scores are derived, and
   a partner must be able to read the answer behind any number.
8. **Never imply causation from a single cycle.** Movement is reported with the
   control comparison, the window, and the list of other changes that happened
   in that window.

## The three signals, with distinct jobs

| Signal | What it is | Its job | In the headline metric |
| --- | --- | --- | --- |
| A — Answer recommendations | Sampled answers across engines and questions | The metric | Yes |
| B — AI referrals | Attributed sessions from AI sources, via referrer patterns and UTMs | The outcome | No |
| C — Crawler activity | Bot requests in server or CDN logs | Diagnostics: is the content being fetched at all | No |

Signal C answers a useful question — "have the engines even seen the new page?" —
and it belongs in the report as context for Signal A. It does not belong in the
score.

## Implementation sketch

Enough structure to start, not a spec to defend.

```
POST /api/questions/propose     body: { domain, competitors[], brief }
                                returns: proposed questions with intent stage
POST /api/runs                  body: { questionIds[], engines[], runs }
                                queues probe jobs, returns a run id
GET  /api/share?runId=          returns share, lost share, band, per-engine,
                                per-intent breakdown, control comparison
GET  /api/answers/:id           raw answer, citations, model, timestamp
POST /api/briefs                body: { questionId, evidenceIds[] }
                                returns a content brief
```

Tables:

```
questions(id, brand_id, text, intent_stage, is_control, created_at)
probes(id, question_id, engine, model, surface, run_index, created_at)
answers(id, probe_id, raw_text, citations_json, parsed_state, confidence)
shares(id, brand_id, window_start, window_end, scope_json, value, band, n)
briefs(id, question_id, hypothesis, changes_json, published_at, followup_run_id)
```

Three rules worth writing down before any code:

- Probing is server-side and rate-limited. No provider credentials reach the
  browser, ever.
- `probes.surface` is a required column. The schema itself should make an
  undeclared surface impossible.
- `questions.is_control` is set at creation and never changes retroactively.
  Moving a question into the control set after seeing the data destroys the
  comparison.

