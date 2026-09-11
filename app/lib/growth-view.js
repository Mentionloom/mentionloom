import { icon, escape as esc } from "./ui.js";
import { fmt, pct } from "./model.js";
import { ENGINES } from "./data.js";
import { canShip } from "./growth.js";

export function nextMoveHTML(items, work, context) {
  const next = items.find((a) => !a.completed);
  if (!next)
    return `<div class="focus-label">${icon("circlecheck")} ${items.length ? "Ready to measure" : "Explore your coverage"}</div><h2>${items.length ? "You’ve shipped the work." : "Find your next opening."}</h2><p>${items.length ? "Keep the baseline. Look for a change in new answer samples." : "Explore these questions or broaden your filters to find your next improvement."}</p><div class="focus-empty-number">${items.length || context.gaps.length}<span>${items.length ? "improvements shipped" : "questions with gaps"}</span></div><button class="button primary" data-action="${items.length ? "growth-review" : "growth-gaps"}">${items.length ? "Review results" : "Explore questions"}${icon("right")}</button>`;
  const record = work[next.id],
    count = record?.checked.length || 0;
  const q = next.questionData,
    missingRate = q.samples ? (next.missing / q.samples) * 100 : 0;
  return `<div class="focus-label">${icon(record ? "list-todo" : "target")} ${record ? "Continue your improvement" : "Recommended next"}<span>${next.effort}</span></div>
    <h2>${esc(next.title.replace(/\.$/, ""))}</h2>
    <button class="focus-question" data-question="${q.id}">${esc(q.text)}${icon("right")}</button>
    <div class="focus-evidence"><strong>${Math.round(missingRate)}<small>%</small></strong><span>of sampled answers<br>don’t mention Acme</span></div>
    <div class="evidence-track" role="img" aria-label="Acme is missing in ${next.missing} of ${q.samples} sampled answers"><span style="transform:scaleX(${missingRate / 100})"></span></div>
    <div class="evidence-caption"><span>${fmt(next.missing)} of ${fmt(q.samples)} answers</span><button class="text-button" data-action="growth-priority">Why this?</button></div>
    <div class="focus-action"><button class="button primary" data-growth-start="${next.id}">${record ? "Continue improvement" : "Start improvement"}${icon("right")}</button><span>${record ? `${count} of ${next.steps.length} steps complete` : "A focused, 3-step plan"}</span></div>`;
}

export function journeyHTML(items, context, work) {
  const active = items.filter((a) => !a.completed && work[a.id]).length;
  const done = items.filter((a) => a.completed).length;
  return `<button data-action="growth-gaps"><span class="journey-marker">${icon("search")}</span><span><strong>Find the gaps</strong><small>${context.gaps.length} questions to explore</small></span>${icon("right")}</button>
    <button data-action="growth-improve"><span class="journey-marker current">${icon("list-todo")}</span><span><strong>Make your next move</strong><small>${active ? `${active} in progress` : `${items.length - done} suggested improvements`}</small></span>${icon("right")}</button>
    <button data-action="growth-review"><span class="journey-marker ${done ? "complete" : ""}">${icon("chart")}</span><span><strong>Measure the change</strong><small>${done ? `${done} shipped · awaiting new data` : "Save a baseline, then compare"}</small></span>${icon("right")}</button>`;
}

export function competitorHTML(competitors) {
  const brands = { Asana: "asana", Notion: "notion", ClickUp: "clickup" };
  return competitors
    .map(
      (c, i) =>
        `<button class="rank-row ${c.self ? "self" : ""}" data-competitor="${esc(c.name)}" style="--share:${c.share}%"><span class="rank-index">${1 + competitors.filter((brand) => brand.share > c.share).length}</span>${c.self ? '<span class="acme-mark">a</span>' : brands[c.name] ? `<img class="competitor-mark" src="/assets/brands/${brands[c.name]}.svg" width="20" height="20" alt="">` : '<span class="competitor-mark" aria-hidden="true"></span>'}<span class="rank-name">${esc(c.name)}${c.self ? ' <span class="badge">You</span>' : ""}</span><strong class="rank-value">${pct(c.share)}</strong>${icon("right")}</button>`,
    )
    .join("");
}

export function workbenchHTML(action, record, done, baseline, question) {
  const count = done ? action.steps.length : record?.checked.length || 0;
  const rate = baseline?.samples ? pct(baseline.visibility) : "—";
  return `<div class="work-stages" aria-label="Improvement workflow"><span class="complete">${icon("check")} Evidence</span><span class="${done ? "complete" : "current"}">${icon(done ? "check" : "edit")} Improve</span><span class="${done ? "current" : ""}">${icon("chart")} Measure</span></div>
    <p class="work-intro">${esc(action.body)}</p>
    <div class="work-baseline"><div><span>${record?.baseline ? "Saved baseline" : "Current mention rate"}</span><strong>${rate}</strong></div><div><span>Answers mentioning Acme</span><strong>${fmt(baseline?.mentions || 0)}<small> / ${fmt(baseline?.samples || 0)}</small></strong></div></div>
    <button class="work-question" data-question="${action.question}">${icon("chat")}<span>${esc(question.text)}<small>View the sampled answers</small></span>${icon("right")}</button>
    ${
      done
        ? `<div class="work-complete">${icon("circlecheck")}<div><h3>Shipped. Ready for the next sample.</h3><p>Your checklist is complete. New measurements will tell you whether visibility changed.</p></div></div><button class="button primary" data-growth-review="${action.id}">Review results${icon("right")}</button><button class="text-button reopen-work" data-ship="${action.id}">Reopen improvement</button>`
        : record
          ? `<div class="checklist-heading"><h3>Your improvement plan</h3><span id="work-count">${count} / ${action.steps.length} complete</span></div><div class="work-progress" role="progressbar" aria-label="Improvement steps" aria-valuemin="0" aria-valuemax="${action.steps.length}" aria-valuenow="${count}"><span style="transform:scaleX(${count / action.steps.length})"></span></div><div class="work-checklist">${action.steps.map((s, i) => `<label class="choice work-step ${record.checked.includes(i) ? "is-done" : ""}"><input type="checkbox" data-work-step="${i}" data-work-action="${action.id}" ${record.checked.includes(i) ? "checked" : ""}><span><span class="step-caption">Step ${i + 1}</span>${esc(s)}</span></label>`).join("")}</div><div class="work-target">${icon("file")}<span>Update this page<strong>acme.work${esc(action.path)}</strong></span><span>${action.effort}</span></div><div class="work-finish"><button class="button primary" data-ship="${action.id}" ${canShip(action, { [action.id]: record }) ? "" : 'disabled aria-describedby="ship-hint"'}>${icon("check")}Mark as shipped</button><p id="ship-hint">${count === action.steps.length ? "Finished on your website? Record the change here." : "Complete the checklist to record this as shipped."}</p></div>`
          : `<div class="plan-preview"><span>${icon("clock")}${action.effort}</span><span>${action.steps.length} concrete steps</span><span>${icon("file")}${esc(action.path)}</span></div><button class="button primary" data-growth-start="${action.id}">Start improvement${icon("right")}</button>`
    }
    <p class="work-disclaimer">Demo workspace · Progress stays in this browser. Nothing is published to your website.</p>`;
}

export function reviewHTML(action, record) {
  const baseline = record?.baseline;
  const source = baseline?.engine
    ? ENGINES.find((e) => e.id === baseline.engine)?.name
    : "All engines";
  return `<div class="work-stages"><span class="complete">${icon("check")} Evidence</span><span class="complete">${icon("check")} Improve</span><span class="current">${icon("chart")} Measure</span></div><p class="work-intro">${esc(action.title)}</p><div class="result-comparison"><div><span>Before your change</span><strong>${baseline?.samples ? pct(baseline.visibility) : "—"}</strong><small>${baseline ? `${fmt(baseline.mentions)} of ${fmt(baseline.samples)} answers` : "No saved baseline"}</small></div><span>${icon("right")}</span><div><span>After your change</span><strong>—</strong><small>Awaiting new samples</small></div></div><div class="result-waiting">${icon("clock")}<span><strong>The work is done. The impact is still unknown.</strong>New answer samples are needed before a change can be measured.</span></div>${baseline ? `<p class="small-label">Baseline: ${esc(baseline.start)} – ${esc(baseline.end)} · ${esc(source || "All engines")}</p>` : ""}<h3>What to watch</h3><div class="measure-row">${icon("eye")}<span>Mention rate for this question</span></div><div class="measure-row">${icon("link")}<span>Citations of ${esc(action.path)}</span></div><div class="measure-row">${icon("people")}<span>AI referrals to the updated page</span></div><button class="button primary" data-question="${action.question}">Explore current answers${icon("right")}</button><button class="text-button reopen-work" data-action="sources">Review data connections${icon("right")}</button><p class="work-disclaimer">The demo has no post-change data. Answer sampling must be connected for ongoing measurement.</p>`;
}
