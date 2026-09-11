import { icon, escape as esc } from "./ui.js";

const status = (addon, state) => {
  if (state?.state === "active")
    return '<span class="badge green"><span class="status-dot"></span>Active</span>';
  if (state?.state === "pilot")
    return '<span class="badge purple">Pilot joined</span>';
  return addon.access === "pilot"
    ? '<span class="badge">Pilot</span>'
    : '<span class="badge purple">Available</span>';
};

export function addonRowHTML(addon, state, featured = false) {
  return `<button class="addon-row${featured ? " featured" : ""}" data-addon="${addon.id}">
    <span class="addon-icon">${icon(addon.icon)}</span>
    <span class="addon-copy"><span class="addon-title">${esc(addon.name)}${status(addon, state)}</span><span>${esc(addon.description)}</span></span>
    <span class="addon-contract"><small>Watches</small>${esc(addon.watches)}</span>
    <span class="addon-state">${state ? (state.state === "active" ? "Manage" : "View pilot") : addon.access === "pilot" ? "Join pilot" : "Add"}${icon("right")}</span>
  </button>`;
}

export function addonDetailHTML(addon, state, preview) {
  const active = state?.state === "active";
  const pilot = state?.state === "pilot";
  return `<div class="addon-detail-lead"><span class="addon-icon large">${icon(addon.icon)}</span><p>${esc(addon.description)}</p></div>
    <div class="signal-contract" aria-label="Add-on signal contract">
      <div><small>Watches</small><strong>${esc(addon.watches)}</strong></div>
      <span>${icon("right")}</span>
      <div><small>Creates</small><strong>${esc(addon.creates)}</strong></div>
    </div>
    <div class="addon-need">${icon("layers")}<span><small>Data needed</small><strong>${esc(addon.needs)}</strong></span></div>
    <h3>Inside the add-on</h3>${preview}
    ${active ? `<div class="addon-active-note">${icon("circlecheck")}<span><strong>Active in this demo workspace</strong>This add-on will use connected signals as they become available.</span></div><button class="button" data-addon-remove="${addon.id}">Remove add-on</button>` : pilot ? `<div class="addon-active-note pilot">${icon("check")}<span><strong>You joined the pilot</strong>We saved your interest in this browser. No request was sent.</span></div><button class="button" data-addon-remove="${addon.id}">Leave pilot</button>` : addon.access === "pilot" ? `<button class="button primary" data-addon-enable="${addon.id}">Join the pilot${icon("right")}</button><p class="addon-disclaimer">This records pilot interest in the demo only. A production flow would capture workspace ownership and consent.</p>` : `<button class="button primary" data-addon-enable="${addon.id}">Add to Mentionloom${icon("plus")}</button><p class="addon-disclaimer">Demo activation only. No email, alert or external service is connected.</p>`}`;
}
