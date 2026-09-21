(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const dialog = $("#join-dialog");
  const storageKey = "mentionloom-waitlist";
  let stage = "signup",
    source = "direct",
    busy = false,
    token = "",
    requestId = crypto.randomUUID();
  let requestEmail = "";
  try {
    token = sessionStorage.getItem(storageKey) || "";
  } catch {}
  const copy = {
    signup: [
      "EARLY ACCESS",
      "Join Mentionloom<br>early access.",
      "See where your brand appears in AI answers—and what to improve when it doesn’t. We’ll email you when access opens.",
    ],
    profile: [
      "Your place is saved",
      "Make it<br>yours.",
      "What brings you here? Help us make Mentionloom useful for the way you work.",
    ],
    success: [
      "YOU’RE IN",
      "You’re on<br>the waitlist.",
      "Your email is saved. We’ll email you when access opens—nothing else to fill out.",
    ],
    removed: [
      "All taken care of",
      "Your details<br>are removed.",
      "You’re welcome back whenever the time is right.",
    ],
  };
  function remember(value) {
    token = value;
    try {
      if (value) sessionStorage.setItem(storageKey, value);
      else sessionStorage.removeItem(storageKey);
    } catch {}
  }
  function show(next, focus = true) {
    stage = next;
    document
      .querySelectorAll("[data-waitlist-stage]")
      .forEach((el) => (el.hidden = el.dataset.waitlistStage !== stage));
    $("#join-eyebrow").textContent = copy[stage][0];
    $("#join-title").innerHTML = copy[stage][1];
    $("#join-description").textContent = copy[stage][2];
    const index = stage === "signup" ? 0 : stage === "profile" ? 1 : 2;
    $(".waitlist-progress").setAttribute(
      "aria-label",
      `Step ${index + 1} of 3`,
    );
    document.querySelectorAll(".waitlist-progress>span").forEach((el, i) => {
      el.classList.toggle("is-current", i === index);
      el.classList.toggle("is-done", i < index);
    });
    $(".waitlist-management").hidden = !token;
    $("#remove-confirm").hidden = true;
    dialog.scrollTop = 0;
    if (focus) $("#join-title").focus({ preventScroll: true });
  }
  function errorAt(id, message = "") {
    const el = $(id);
    el.textContent = message;
    el.hidden = !message;
    if (message) {
      el.tabIndex = -1;
      el.focus();
    }
  }
  async function send(action, payload = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal,
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(
          "We couldn’t reach the waitlist. Please try again in a moment.",
        );
      }
      if (!response.ok || !data.ok)
        throw Object.assign(
          new Error(data.error || "We couldn’t save that. Please try again."),
          { status: response.status },
        );
      return data;
    } catch (error) {
      if (error.name === "AbortError")
        throw new Error(
          "That took a little longer than expected. Please try again; we’ll avoid duplicate signups.",
        );
      if (error instanceof TypeError)
        throw new Error(
          "Check your connection and try again. Your details are still here.",
        );
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function perform(button, label, errorId, action) {
    if (busy) return;
    busy = true;
    errorAt(errorId);
    const text = button.querySelector("span") || button;
    const original = text.textContent;
    text.textContent = label;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    $("#skip-profile").disabled = true;
    try {
      await action();
    } catch (error) {
      errorAt(errorId, error.message);
    } finally {
      text.textContent = original;
      button.disabled = false;
      button.removeAttribute("aria-busy");
      $("#skip-profile").disabled = false;
      busy = false;
    }
  }
  async function open(buttonSource) {
    source = buttonSource || "direct";
    if (!dialog.open) dialog.showModal();
    if (token && stage !== "profile") {
      try {
        await send("status", { token });
        show("success");
      } catch (error) {
        if ([401, 404].includes(error.status)) {
          remember("");
          show("signup");
        } else {
          show("signup");
          errorAt(
            "#join-error",
            "We couldn’t check your saved signup. You can safely try joining again.",
          );
        }
      }
    } else {
      show(stage === "removed" ? "signup" : stage, false);
      if (stage === "signup") $("#email").focus();
    }
  }
  document.querySelectorAll("[data-join]").forEach((button) =>
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const properties = {
        source: String(button.dataset.join || "direct").slice(0, 120),
      };
      const kobbeEvent = { name: "waitlist_click", properties, timestamp: Date.now() };
      window.__kobbeEvents = window.__kobbeEvents || [];
      window.__kobbeEvents.push(kobbeEvent);
      if (window.__kobbeEvents.length > 200) window.__kobbeEvents.shift();
      try { window.kobbe?.track?.("waitlist_click", properties); } catch {}
      try { window.dispatchEvent(new CustomEvent("kobbe:event", { detail: kobbeEvent })); } catch {}
      open(button.dataset.join);
    }),
  );
  $(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  });
  function attribution() {
    const query = new URLSearchParams(location.search),
      values = {};
    for (const name of ["utm_source", "utm_medium", "utm_campaign", "ref"])
      if (query.has(name)) values[name] = query.get(name).slice(0, 100);
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin !== location.origin)
        values.referrer = referrer.origin;
    } catch {}
    return values;
  }
  $("#join-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const email = $("#email").value.trim().toLowerCase();
    if (requestEmail && email !== requestEmail) requestId = crypto.randomUUID();
    requestEmail = email;
    perform(
      $("#join-form button[type=submit]"),
      "Saving your place…",
      "#join-error",
      async () => {
        const data = await send("signup", {
          email,
          consent: $("#waitlist-consent").checked,
          company_fax: $("#company-fax").value,
          requestId,
          source,
          attribution: attribution(),
        });
        remember(data.token || "");
        show("success");
      },
    );
  });
  $("#profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    perform(
      $("#profile-form button[type=submit]"),
      "Saving your preferences…",
      "#profile-error",
      async () => {
        await send("profile", {
          token,
          website: form.get("website").trim(),
          role: form.get("role") || "",
          goal: form.get("goal") || "",
          urgency: form.get("urgency") || "",
          tracking: form.get("tracking") || "",
        });
        show("success");
      },
    );
  });
  $("#skip-profile").addEventListener("click", () => {
    if (!busy) show("success");
  });
  async function copyLink(value, message) {
    try {
      await navigator.clipboard.writeText(value);
      $("#copy-fallback").hidden = true;
      $("#copy-status").textContent = message;
    } catch {
      $("#copy-fallback").value = value;
      $("#copy-fallback").hidden = false;
      $("#copy-fallback").select();
      $("#copy-status").textContent = "Copy the selected link below.";
    }
  }
  $("#share-waitlist")?.addEventListener("click", () =>
    copyLink(
      `${location.origin}/?ref=waitlist`,
      "Invite link copied. Share it with someone who’d find this useful.",
    ),
  );
  $("#save-signup-link").addEventListener("click", () => {
    if (token)
      copyLink(
        `${location.origin}/#signup=${token}`,
        "Private signup link copied. Keep it somewhere safe; it lets you remove your signup.",
      );
  });
  $("#remove-signup").addEventListener("click", () => {
    $("#remove-confirm").hidden = false;
    $("#keep-signup").focus();
  });
  $("#keep-signup").addEventListener("click", () => {
    $("#remove-confirm").hidden = true;
    $("#remove-signup").focus();
  });
  $("#confirm-remove").addEventListener("click", () =>
    perform($("#confirm-remove"), "Removing…", "#manage-error", async () => {
      await send("remove", { token });
      remember("");
      requestId = crypto.randomUUID();
      requestEmail = "";
      $("#join-form").reset();
      $("#profile-form").reset();
      show("removed");
    }),
  );
  $("#back-to-product")?.addEventListener("click", () => {
    dialog.close();
    location.assign("/app/");
  });
  $("#close-success")?.addEventListener("click", () => dialog.close());
  $("#close-removed").addEventListener("click", () => dialog.close());
  if (location.hash.startsWith("#signup=")) {
    const candidate = location.hash.slice(8);
    history.replaceState(null, "", location.pathname + location.search);
    if (/^[a-f0-9]{64}\.[a-f0-9-]{36}\.[a-f0-9]{64}$/i.test(candidate)) {
      remember(candidate);
      open("direct");
    }
  }
})();
