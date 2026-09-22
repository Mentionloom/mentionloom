import { icon, escape as esc } from "./ui.js";
import { fmt, pct } from "./model.js";
import { ENGINES } from "./data.js";
import { canShip } from "./growth.js";
import { recommendationEvidence } from "./intelligence.js";

export function nextMoveHTML(items, work) {
  const next = items.find((a) => !a.completed && a.questionData.samples > 0);
  if (!next) {
    const done = items.length > 0 && items.every((a) => a.completed);
    return `<div class="focus-label">${icon(done ? "circlecheck" : "search")} ${done ? "Ready to measure" : "Explore your coverage"}</div><h2>${done ? "You’ve shipped the work." : "Find your next opening."}</h2><p>${done ? "Look for a change in new answer samples." : "Explore questions or broaden your filters."}</p><button class="button" data-action="${done ? "growth-review" : "growth-gaps"}">${done ? "Review results" : "Explore questions"}${icon("right")}</button>`;
  }
  const record = work[next.id],
    count = record?.checked.length || 0,
    q = next.questionData,
    missingRate = (next.missing / q.samples) * 100,
    evidence = recommendationEvidence(q.rows),
    leader = evidence.competitors[0],
    brand = { Asana: "asana", Notion: "notion", ClickUp: "clickup" }[leader?.name];
  return `<div class="agent-header">
      <div class="agent-identity"><span class="agent-orb" data-fluid-orb data-color="#8FB8F4" aria-hidden="true"><canvas></canvas></span><strong>Mentionloom AI</strong><span class="badge neutral">Preview</span></div>
      <span class="agent-status">${icon(record ? "list-todo" : "circlecheck")}${record ? `${count} / ${next.steps.length} steps complete` : "Plan ready"}</span>
    </div>
    <div class="agent-heading card-heading"><h2>${esc(next.title.replace(/\.$/, ""))}</h2><button class="button" data-growth-start="${next.id}">${record ? "Continue plan" : "Start plan"}${icon("right")}</button></div>
    <div class="agent-reasoning">
      <button class="agent-insight agent-question" data-question="${q.id}"><span class="agent-label">Buyer question</span><span class="agent-insight-body"><strong>${esc(q.text)}</strong>${icon("right")}</span></button>
      <button class="agent-insight agent-competitor" data-recommendation-question="${q.id}"><span class="agent-label">Appears instead</span><span class="agent-insight-body"><span class="agent-brand">${brand ? `<img src="/assets/brands/${brand}.svg" width="28" height="28" alt="">` : ""}<strong>${esc(leader?.name || "No competitor")}</strong></span>${icon("right")}</span><span class="agent-support">${leader ? `${fmt(leader.count)} answers without Acme` : "In this sample"}</span></button>
      <button class="agent-insight agent-position" data-recommendation-question="${q.id}"><span class="agent-label">Your visibility gap</span><span class="agent-insight-body"><strong class="agent-number">${Math.round(missingRate)}%</strong>${icon("right")}</span><span class="agent-support">of answers miss Acme</span></button>
      <div class="agent-plan"><span class="agent-label">Suggested plan</span><ol>${next.steps.map((step, i) => `<li class="${record?.checked.includes(i) ? "is-complete" : ""}"><span class="agent-step" aria-hidden="true">${record?.checked.includes(i) ? icon("check") : i + 1}</span><span>${esc(next.stepLabels?.[i] || step)}</span>${record?.checked.includes(i) ? '<span class="sr-only">Completed</span>' : ""}</li>`).join("")}</ol></div>
    </div>`;
}

export function journeyHTML(items, context, work) {
  const active = items.filter((a) => !a.completed && work[a.id]).length;
  const done = items.filter((a) => a.completed).length;
  return `<button data-action="growth-gaps"><span class="journey-marker">${icon("search")}</span><span><strong>Gaps</strong><small>${context.gaps.length} questions to explore</small></span>${icon("right")}</button>
    <button data-action="growth-improve"><span class="journey-marker current">${icon("list-todo")}</span><span><strong>Improvements</strong><small>${active ? `${active} in progress` : `${items.length - done} suggested improvements`}</small></span>${icon("right")}</button>
    <button data-action="growth-review"><span class="journey-marker ${done ? "complete" : ""}">${icon("chart")}</span><span><strong>Results</strong><small>${done ? `${done} shipped · awaiting new data` : "Save a baseline, then compare"}</small></span>${icon("right")}</button>`;
}

export function competitorHTML(competitors) {
  const brands = { Asana: "asana", Notion: "notion", ClickUp: "clickup" };
  return competitors
    .map(
      (c, i) =>
        `<button class="rank-row ${c.self ? "self" : ""}" data-competitor="${esc(c.name)}" style="--share:${c.share}%"><span class="rank-index">${1 + competitors.filter((brand) => brand.share > c.share).length}</span>${c.self ? '<span class="acme-mark" aria-hidden="true"><img src="/assets/brands/acme.svg" width="32" height="32" alt=""></span>' : brands[c.name] ? `<img class="competitor-mark" src="/assets/brands/${brands[c.name]}.svg" width="20" height="20" alt="">` : '<span class="competitor-mark" aria-hidden="true"></span>'}<span class="rank-name">${esc(c.name)}${c.self ? ' <span class="badge">You</span>' : ""}</span><strong class="rank-value">${pct(c.share)}</strong>${icon("right")}</button>`,
    )
    .join("");
}

export function workbenchHTML(action, record, done, baseline, question) {
  const count = done ? action.steps.length : record?.checked.length || 0;
  const rate = baseline?.samples ? pct(baseline.visibility) : "—";
  const priority = action.evidence?.samples && action.evidence.lostAnswers / action.evidence.samples >= .6 ? "High" : action.evidence?.lostAnswers ? "Medium" : "Low";
  return `<div class="work-stages" aria-label="Improvement workflow"><span class="complete">${icon("check")} Evidence</span><span class="${done ? "complete" : "current"}">${icon(done ? "check" : "edit")} Improve</span><span class="${done ? "current" : ""}">${icon("chart")} Measure</span></div>
    ${action.evidence ? `<div class="intelligence-action"><div class="evidence-summary"><strong>${action.evidence.lostAnswers} / ${action.evidence.samples} answers lost</strong><span class="badge neutral">${priority} priority</span></div><details><summary>Why this change?${icon("down")}</summary><p>${esc(action.body)}</p><p>Check ${esc(action.path)} for ${esc(action.label.toLowerCase())} evidence. Priority reflects competitor-only answer frequency: high at 60% or more, medium above zero. Confirm the content gap before editing; impact is unmeasured.</p></details></div>` : `<p class="work-intro">${esc(action.body)}</p>`}
    <div class="work-baseline"><div><span>${record?.baseline ? "Saved baseline" : "Current mention rate"}</span><strong>${rate}</strong></div><div><span>Answers mentioning Acme</span><strong>${fmt(baseline?.mentions || 0)}<small> / ${fmt(baseline?.samples || 0)}</small></strong></div></div>
    <button class="work-question" data-question="${action.question}">${icon("chat")}<span>${esc(question.text)}</span>${icon("right")}</button>
    ${
      done
        ? `<div class="work-complete">${icon("circlecheck")}<div><h3>Shipped. Ready for the next sample.</h3><p>Your checklist is complete. New measurements will tell you whether visibility changed.</p></div></div><button class="button" data-growth-review="${action.id}">Review results${icon("right")}</button><button class="text-button reopen-work" data-ship="${action.id}">Reopen improvement</button>`
        : record
          ? `<div class="checklist-heading"><h3>Plan</h3><span id="work-count">${count} / ${action.steps.length} complete</span></div><div class="work-progress" role="progressbar" aria-label="Improvement steps" aria-valuemin="0" aria-valuemax="${action.steps.length}" aria-valuenow="${count}"><span style="transform:scaleX(${count / action.steps.length})"></span></div><div class="work-checklist">${action.steps.map((s, i) => `<label class="choice work-step ${record.checked.includes(i) ? "is-done" : ""}"><input type="checkbox" data-work-step="${i}" data-work-action="${action.id}" ${record.checked.includes(i) ? "checked" : ""}><span><span class="step-caption">Step ${i + 1}</span>${esc(s)}</span></label>`).join("")}</div><div class="work-target">${icon("file")}<span>Update this page<strong>acme.work${esc(action.path)}</strong></span><span>${action.effort}</span></div><div class="work-finish"><button class="button primary" data-ship="${action.id}" ${canShip(action, { [action.id]: record }) ? "" : 'disabled aria-describedby="ship-hint"'}>${icon("check")}Mark as shipped</button><p id="ship-hint">${count === action.steps.length ? "Finished on your website? Record the change here." : "Complete the checklist to record this as shipped."}</p></div>`
          : `<div class="plan-preview"><span>${icon("clock")}${action.effort}</span><span>${action.steps.length} concrete steps</span><span>${icon("file")}${esc(action.path)}</span></div><button class="button" data-growth-start="${action.id}">Start improvement${icon("right")}</button>`
    }
    <p class="work-disclaimer">Demo workspace · Progress stays in this browser. Nothing is published to your website.</p>`;
}

export function reviewHTML(action, record) {
  const baseline = record?.baseline;
  const source = baseline?.engine
    ? ENGINES.find((e) => e.id === baseline.engine)?.name
    : "All engines";
  return `<div class="work-stages"><span class="complete">${icon("check")} Evidence</span><span class="complete">${icon("check")} Improve</span><span class="current">${icon("chart")} Measure</span></div><p class="work-intro">${esc(action.title)}</p><div class="result-comparison"><div><span>Before your change</span><strong>${baseline?.samples ? pct(baseline.visibility) : "—"}</strong><small>${baseline ? `${fmt(baseline.mentions)} of ${fmt(baseline.samples)} answers` : "No saved baseline"}</small></div><span>${icon("right")}</span><div><span>After your change</span><strong>—</strong><small>Awaiting new samples</small></div></div><div class="result-waiting">${icon("clock")}<span><strong>The work is done. The impact is still unknown.</strong>New answer samples are needed before a change can be measured.</span></div>${baseline ? `<p class="small-label">Baseline: ${esc(baseline.start)} – ${esc(baseline.end)} · ${esc(source || "All engines")}</p>` : ""}<h3>Metrics</h3><div class="measure-row">${icon("eye")}<span>Mention rate for this question</span></div><div class="measure-row">${icon("link")}<span>Citations of ${esc(action.path)}</span></div><div class="measure-row">${icon("people")}<span>AI referrals to the updated page</span></div><button class="button" data-question="${action.question}">Explore current answers${icon("right")}</button><button class="text-button reopen-work" data-action="sources">Review data connections${icon("right")}</button><p class="work-disclaimer">The demo has no post-change data. Answer sampling must be connected for ongoing measurement.</p>`;
}
