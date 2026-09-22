(() => {
  "use strict";
  const dialog = document.querySelector("#join-dialog");
  if (!dialog) return;

  // A single shared component replaces the legacy, duplicated page templates.
  // Mount before any CTA can open the dialog; no private-link/profile UI remains.
  dialog.classList.add("waitlist-dialog");
  dialog.innerHTML = `
    <button class="dialog-close waitlist-dismiss" type="button" aria-label="Close waitlist">
      <svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
    <section class="waitlist-signup" data-waitlist-stage="signup">
      <p class="waitlist-eyebrow">EARLY ACCESS</p>
      <h2 class="waitlist-title" id="join-title" tabindex="-1">Get Mentionloom early.</h2>
      <p class="waitlist-description" id="join-description">See where AI recommends your brand—and what to improve.</p>
      <form id="join-form" class="waitlist-form">
        <div class="waitlist-field">
          <label for="email">Email</label>
          <input class="waitlist-input" id="email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@company.com" maxlength="254" autocapitalize="none" spellcheck="false" required />
        </div>
        <div class="waitlist-field">
          <label for="website">Website</label>
          <input class="waitlist-input" id="website" name="website" type="text" autocomplete="url" inputmode="url" placeholder="company.com" maxlength="300" autocapitalize="none" spellcheck="false" required />
        </div>
        <div class="waitlist-trap" aria-hidden="true" inert>
          <label for="company-fax">Company fax</label>
          <input id="company-fax" name="company_fax" type="text" tabindex="-1" autocomplete="off" />
        </div>
        <label class="waitlist-consent" for="waitlist-consent">
          <input id="waitlist-consent" name="consent" type="checkbox" required />
          <span>I agree to receive emails about Mentionloom early access and launch updates.</span>
        </label>
        <p class="waitlist-error" id="join-error" role="alert" tabindex="-1" hidden></p>
        <button class="button primary waitlist-submit" type="submit"><span>Join the waitlist</span></button>
        <p class="waitlist-legal"><a href="/privacy.html" target="_blank" rel="noopener">Privacy policy</a><span aria-hidden="true"> · </span><a href="/terms.html" target="_blank" rel="noopener">Terms</a></p>
      </form>
    </section>
    <section class="waitlist-success" data-waitlist-stage="success" hidden>
      <div class="waitlist-success-check" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6" /></svg>
      </div>
      <h2 class="waitlist-title" id="join-success-title" tabindex="-1">YOU’RE ON THE LIST</h2>
      <p class="waitlist-description" id="join-success-description">We’ll email you when your early access is ready.</p>
      <button class="button primary waitlist-done" id="close-success" type="button">Done</button>
    </section>`;

  const $ = (selector) => dialog.querySelector(selector);
  const form = $("#join-form");
  const emailInput = $("#email");
  const websiteInput = $("#website");
  const submitButton = $(".waitlist-submit");
  const errorElement = $("#join-error");
  const storageKey = "mentionloom-waitlist";
  const tokenPattern = /^[a-f0-9]{64}\.[a-f0-9-]{36}\.[a-f0-9]{64}$/i;
  let token = "";
  try { token = sessionStorage.getItem(storageKey) || ""; } catch {}
  if (!tokenPattern.test(token)) token = "";
  let stage = token ? "success" : "signup";
  let source = "direct";
  let busy = false;
  let trigger = null;
  let requestId = crypto.randomUUID();
  let requestEmail = "";

  function remember(value) {
    token = typeof value === "string" && tokenPattern.test(value) ? value : "";
    try {
      if (token) sessionStorage.setItem(storageKey, token);
      else sessionStorage.removeItem(storageKey);
    } catch {}
  }

  function show(next, focus = true) {
    stage = next;
    dialog.dataset.stage = stage;
    dialog.querySelectorAll("[data-waitlist-stage]").forEach((element) => {
      element.hidden = element.dataset.waitlistStage !== stage;
    });
    $(".waitlist-dismiss").hidden = stage === "success";
    const titleId = stage === "success" ? "join-success-title" : "join-title";
    const descriptionId = stage === "success" ? "join-success-description" : "join-description";
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.setAttribute("aria-describedby", descriptionId);
    dialog.scrollTop = 0;
    if (focus && dialog.open) {
      (stage === "success" ? $("#join-success-title") : emailInput).focus({ preventScroll: true });
    }
  }

  function errorAt(message = "") {
    errorElement.textContent = message;
    errorElement.hidden = !message;
    if (message && dialog.open) errorElement.focus({ preventScroll: false });
  }

  function normalizeWebsite(value) {
    const website = value.trim();
    try {
      if (!website || website.length > 300 || /[\s<>\\]/.test(website)) throw new Error();
      const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
      const labels = url.hostname.split(".");
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
          labels.length < 2 || url.hostname.length > 253 ||
          !labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw new Error();
      return url.origin;
    } catch {
      throw new Error("Enter a valid website, such as company.com.");
    }
  }

  websiteInput.addEventListener("input", () => websiteInput.setCustomValidity(""));
  websiteInput.addEventListener("blur", () => {
    if (!websiteInput.value.trim()) return;
    try { normalizeWebsite(websiteInput.value); websiteInput.setCustomValidity(""); }
    catch (error) { websiteInput.setCustomValidity(error.message); }
  });

  async function send(action, payload = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch("https://osksnjqaxbqjcoqytflp.supabase.co/functions/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal,
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error("We couldn’t reach the waitlist. Please try again in a moment."); }
      if (!response.ok || !data?.ok) {
        throw Object.assign(new Error(data?.error || "We couldn’t save that. Please try again."), { status: response.status });
      }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("That took a little longer than expected. Please try again; we’ll avoid duplicate signups.");
      if (error instanceof TypeError) throw new Error("Check your connection and try again. Your details are still here.");
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function attribution() {
    const query = new URLSearchParams(location.search);
    const values = {};
    for (const name of ["utm_source", "utm_medium", "utm_campaign", "ref"]) {
      if (query.has(name)) values[name] = query.get(name).slice(0, 100);
    }
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin !== location.origin) values.referrer = referrer.origin;
    } catch {}
    return values;
  }

  function setBusy(value) {
    busy = value;
    form.setAttribute("aria-busy", String(value));
    for (const input of form.querySelectorAll("input")) input.disabled = value;
    submitButton.disabled = value;
    if (value) submitButton.setAttribute("aria-busy", "true");
    else submitButton.removeAttribute("aria-busy");
    submitButton.querySelector("span").textContent = value ? "Saving your place…" : "Join the waitlist";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    errorAt();
    const email = emailInput.value.trim().toLowerCase();
    emailInput.value = email;
    let website;
    try { website = normalizeWebsite(websiteInput.value); }
    catch (error) { websiteInput.setCustomValidity(error.message); websiteInput.reportValidity(); return; }
    websiteInput.setCustomValidity("");
    if (!form.reportValidity()) return;
    if (requestEmail && email !== requestEmail) requestId = crypto.randomUUID();
    requestEmail = email;
    const payload = {
      email,
      website,
      formVersion: "email-website-v1",
      consent: $("#waitlist-consent").checked,
      company_fax: $("#company-fax").value,
      requestId,
      source,
      attribution: attribution(),
    };
    setBusy(true);
    try {
      // Email and website are persisted atomically before showing success.
      const data = await send("signup", payload);
      remember(data.token);
      show("success");
    } catch (error) {
      errorAt(error.message);
    } finally { setBusy(false); }
  });

  function open(buttonSource, button = null) {
    source = buttonSource || "direct";
    trigger = button;
    show(stage, false);
    if (!dialog.open) dialog.showModal();
    show(stage);
  }

  // Delegation also covers CTAs added later by the demo app.
  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-join]") : null;
    if (!button) return;
    event.preventDefault();
    const properties = { source: String(button.dataset.join || "direct").slice(0, 120) };
    const kobbeEvent = { name: "waitlist_click", properties, timestamp: Date.now() };
    window.__kobbeEvents = window.__kobbeEvents || [];
    window.__kobbeEvents.push(kobbeEvent);
    if (window.__kobbeEvents.length > 200) window.__kobbeEvents.shift();
    try { window.kobbe?.track?.("waitlist_click", properties); } catch {}
    try { window.dispatchEvent(new CustomEvent("kobbe:event", { detail: kobbeEvent })); } catch {}
    open(button.dataset.join, button);
  });
  $(".waitlist-dismiss").addEventListener("click", () => dialog.close());
  $("#close-success").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });

  show(stage, false);
  // Previously saved links can still confirm a signup; new links are never shown.
  if (location.hash.startsWith("#signup=")) {
    const candidate = location.hash.slice(8);
    history.replaceState(null, "", location.pathname + location.search);
    if (tokenPattern.test(candidate)) {
      send("status", { token: candidate }).then(() => {
        if (busy) return;
        remember(candidate);
        show("success", false);
        open("direct");
      }).catch(() => {});
    }
  }
})();
