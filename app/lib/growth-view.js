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
    leader = evidence.competitors[0];

  return `<div class="agent-header">
      <div class="agent-identity"><span class="agent-orb" data-fluid-orb data-color="#8FB8F4" aria-hidden="true"><canvas></canvas></span><strong>Mentionloom AI</strong><span class="badge neutral">Preview</span></div>
      <span class="agent-status">${record ? `${count} / ${next.steps.length} in progress` : "Suggested next move"}</span>
    </div>
    <div class="agent-native">
      <div class="agent-heading">
        <div><span class="agent-kicker">What</span><h2>${esc(next.title.replace(/\.$/, ""))}</h2></div>
        <button class="button" data-growth-start="${next.id}">${record ? "Continue with Mentionloom" : "Work with Mentionloom"}${icon("right")}</button>
      </div>
      <div class="agent-summary-grid">
        <div><span>Why</span><strong>${leader ? `${fmt(leader.count)} answers choose ${esc(leader.name)} without Acme` : "Acme is missing from this buyer question"}</strong></div>
        <div><span>Why it matters</span><strong>${Math.round(missingRate)}% of sampled answers miss Acme</strong></div>
      </div>
      <button class="agent-evidence-link" data-recommendation-question="${q.id}">See the evidence${icon("right")}</button>
    </div>`;
}

export function growthChatHTML(action, record, done, baseline, question) {
  const count = done ? action.steps.length : record?.checked.length || 0;
  const evidence = action.evidence || { lostAnswers: 0, samples: 0, competitors: [] };
  const leader = evidence.competitors?.[0];
  const rate = baseline?.samples ? pct(baseline.visibility) : "—";
  const checked = record?.checked || [];
  const nextIndex = action.steps.findIndex((_, index) => !checked.includes(index));
  const allDone = done || count === action.steps.length;

  return `<div class="copilot-thread">
    <div class="copilot-message assistant">
      <span class="copilot-avatar">${icon("spark")}</span>
      <div><span class="copilot-label">Mentionloom</span><p><strong>Here’s what I’d work on next.</strong><br>${esc(action.title.replace(/\.$/, ""))}</p></div>
    </div>

    <div class="copilot-facts">
      <div><span>Why</span><strong>${evidence.lostAnswers ? `${fmt(evidence.lostAnswers)} of ${fmt(evidence.samples)} answers miss Acme` : "This question has a visible recommendation gap"}</strong></div>
      <div><span>Why it matters</span><strong>${esc(question.text)}</strong></div>
    </div>

    <div class="copilot-message assistant">
      <span class="copilot-avatar">${icon("chat")}</span>
      <div><span class="copilot-label">Working together</span><p>Pick an action. I’ll keep the plan focused and update progress as you go.</p></div>
    </div>

    <div class="copilot-quick-actions">
      <button class="button" data-recommendation-question="${action.question}">${icon("search")}Show evidence</button>
      <button class="button" data-chat-draft="${action.id}">${icon("file")}Draft the page angle</button>
      <button class="button" data-question="${action.question}">${icon("chat")}Open buyer question</button>
    </div>

    <div class="copilot-draft" data-chat-draft-panel hidden>
      <span class="copilot-label">Draft angle</span>
      <strong>${esc(action.title.replace(/\.$/, ""))}</strong>
      <p>Lead with who Acme is for, compare the workflow buyers care about, then link the supporting proof. Keep every claim verifiable.</p>
    </div>

    <div class="copilot-working-set">
      <div class="copilot-working-head"><div><span class="copilot-label">Working set</span><strong>${count} / ${action.steps.length} complete</strong></div><span class="copilot-baseline">Baseline ${rate}</span></div>
      <div class="copilot-step-list">
        ${action.steps.map((step, index) => {
          const complete = done || checked.includes(index);
          return `<button class="copilot-step ${complete ? "is-complete" : ""}" data-chat-step="${index}" data-work-action="${action.id}" aria-pressed="${complete}"><span class="copilot-step-state">${complete ? icon("check") : index + 1}</span><span><strong>${esc(action.stepLabels?.[index] || `Step ${index + 1}`)}</strong><small>${esc(step)}</small></span>${icon("right")}</button>`;
        }).join("")}
      </div>
    </div>

    <div class="copilot-target">
      <span>${icon("file")}Update</span>
      <strong>acme.work${esc(action.path)}</strong>
      <span>${esc(action.effort)}</span>
    </div>

    <div class="copilot-footer">
      ${allDone
        ? `<button class="button primary" data-ship="${action.id}">${done ? "Reopen improvement" : "Mark as shipped"}${icon("right")}</button>`
        : `<button class="button primary" data-chat-step="${Math.max(0, nextIndex)}" data-work-action="${action.id}">Complete next action${icon("right")}</button>`}
      <span>Progress stays in this demo workspace.</span>
    </div>
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
