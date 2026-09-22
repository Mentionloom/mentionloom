import { icon, escape as esc } from "./ui.js";
import { addonURL, checkoutURL } from "./addons.js";


function addonLogo(addon, large = false) {
  const art = {
    "brief-studio": '<path d="M9 6h13a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z"/><path d="M11 11h9M11 15h7M11 19h5"/><path class="accent" d="M21 5v5h5"/>',
    "competitor-watch": '<circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="5.2"/><path d="M16 6v3M26 16h-3M16 26v-3M6 16h3"/><circle class="accent-fill" cx="22.6" cy="10.6" r="2.1"/>',
    "weekly-brief": '<path d="M7 8.5h18v15H7Z"/><path d="M7 12h18M11 6v4M21 6v4"/><path d="M11 16h4M11 20h8"/><path class="accent" d="m21.5 17 1.2 2.2 2.3 1.1-2.3 1.1-1.2 2.2-1.1-2.2-2.3-1.1 2.3-1.1Z"/>',
    "crawler-guard": '<path d="M16 5 25 8v7c0 6-3.8 10-9 12-5.2-2-9-6-9-12V8Z"/><path d="M12 14h8v7h-8Z"/><path d="M14 14v-2a2 2 0 0 1 4 0v2"/><circle class="accent-fill" cx="16" cy="17.5" r="1"/>',
    "revenue-match": '<circle cx="10" cy="16" r="5"/><circle cx="22" cy="16" r="5"/><path d="M15 16h2"/><path class="accent" d="m19 13 3 3-3 3"/><path d="M8.2 14.4h3.6M8.2 17.6h3.6"/>'
  }[addon.id] || '<circle cx="16" cy="16" r="10"/>';
  return `<span class="market-logo market-logo-${addon.id} ${large ? "large" : ""}" aria-hidden="true"><span class="market-logo-glass"></span><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${art}</svg></span>`;
}

export function productPreview(addon, large = false) {
 const rows = {
  "brief-studio": [["Buyer question", "Best Notion alternative?"], ["Outline", "Fit · workflows · pricing"], ["Source map", "3 supporting pages"]],
  "competitor-watch": [["Asana", "65.4%"], ["Acme", "45.4%"], ["Notion", "41.9%"]],
  "weekly-brief": [["AI visits", "54"], ["Leads", "2"], ["Shipped", "1 improvement"]],
  "crawler-guard": [["GPTBot", "Allowed"], ["ClaudeBot", "Allowed"], ["PerplexityBot", "Review access"]],
  "revenue-match": [["ChatGPT → /pricing", "Qualified"], ["Perplexity → /product", "New lead"], ["Unknown source", "Unmatched"]]
 }[addon.id];
 return `<div class="market-preview ${large ? "large" : ""}" data-addon-visual="${addon.id}" aria-label="${esc(addon.name)} illustrative product preview"><span class="market-fluid-a"></span><span class="market-fluid-b"></span><div class="market-window"><div class="market-window-title">${addonLogo(addon)}<strong>${esc(addon.name)}</strong><span>Sample</span></div>${rows.map(([label,value],i)=>`<div class="market-preview-row"><span>${esc(label)}</span><strong>${esc(value)}</strong>${addon.id === "competitor-watch" ? `<i style="width:${[65,45,42][i]}%"></i>` : ""}</div>`).join("")}${large ? `<div class="market-preview-foot">${icon("check")} ${esc(addon.creates)}</div>` : ""}</div></div>`;
}
export function addonRowHTML(addon, state) {
 return `<a class="market-card" href="${addonURL(addon.id)}" data-addon="${addon.id}" data-category="${esc(addon.category)}">${productPreview(addon)}<div class="market-card-body"><div class="market-card-brand">${addonLogo(addon,true)}<span class="market-category">${esc(addon.category)}</span></div><div class="market-card-title"><h2>${esc(addon.name)}</h2>${state ? `<span class="badge">${state.state === "active" ? "Demo active" : "Pilot saved"}</span>` : addon.access === "pilot" ? '<span class="badge">Coming soon</span>' : ""}</div><p>${esc(addon.description)}</p><span class="market-allowance">${esc(addon.allowance)}</span><div class="market-card-footer"><span>${addon.access === "pilot" ? "Planned" : "From"} <strong>${addon.price}</strong><span> / mo</span></span><span class="market-discover">Details ${icon("right")}</span></div></div></a>`;
}
export function addonDetailHTML(addon, state) {
 const checkout = checkoutURL(addon);
 return `<div class="market-product" data-addon-product="${addon.id}"><div class="market-product-hero"><div class="market-product-copy"><div class="market-product-brand">${addonLogo(addon,true)}<span class="market-category">${esc(addon.category)}</span></div><h2>${esc(addon.headline)}</h2><p>${esc(addon.description)}</p><ul class="market-benefits">${addon.benefits.map(b=>`<li>${icon("check")}<span>${esc(b)}</span></li>`).join("")}</ul></div><aside class="market-purchase" aria-label="${esc(addon.name)} pricing"><span>${addon.access === "pilot" ? "Planned pricing" : "From"}</span><div class="market-price">$${addon.price}<span>USD / month</span></div><p>${esc(addon.allowance)}</p>${checkout ? `<a class="button primary" href="${esc(checkout)}">Continue to Stripe ${icon("right")}</a>` : `<button class="button" disabled>${addon.access === "pilot" ? "Coming soon" : "Checkout unavailable"}</button>`}<span class="market-price-note">${addon.samplePricing ? "Sample pricing. Purchases are not enabled." : "Recurring subscription. Confirm billing terms on Stripe."}</span><button class="text-button" data-addon-demo="${addon.id}">${state ? "Manage demo" : addon.access === "pilot" ? "Preview pilot" : "Try in demo"}</button></aside></div><figure class="market-product-demo">${productPreview(addon,true)}<figcaption>Illustrative product preview · sample data</figcaption></figure><section class="market-workflow"><h2>How it works</h2><ol>${addon.workflow.map((step,i)=>`<li><span>${i+1}</span><h3>${esc(step)}</h3></li>`).join("")}</ol></section><section class="market-comparison"><h2>In your workflow</h2><div><article><span>Before</span><p>${esc(addon.before)}</p></article><article><span>With ${esc(addon.name)}</span><p>${esc(addon.after)}</p></article></div></section><details class="market-requirements"><summary>What you need</summary><p>${esc(addon.needs)}. ${addon.access === "pilot" ? "This product is in development; the preview shows the intended workflow." : "The current workspace is a demo. Trying an add-on does not connect external services."}</p></details></div>`;
}
export function addonDemoHTML(addon,state,preview) {
 return `<p>${esc(addon.description)}</p>${preview}<p class="small-label">Demo only. No purchase, email or external connection is made.</p><button class="button" ${state ? `data-addon-remove="${addon.id}"` : `data-addon-enable="${addon.id}"`}>${state ? "Remove from demo" : addon.access === "pilot" ? "Save pilot interest" : "Enable in demo"}</button>`;
}
