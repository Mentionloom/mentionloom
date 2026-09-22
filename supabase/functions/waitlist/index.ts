import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const allowedOrigins = [
  /^https:\/\/(?:www\.)?mentionloom\.com$/,
  /^https:\/\/mentionloom\.vercel\.app$/,
  /^https:\/\/(?:[a-z0-9-]+\.)?mentionloom\.pages\.dev$/,
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
];

const encoder = new TextEncoder();
const consentText = "I agree to receive emails about Mentionloom early access and launch updates.";

function cors(origin: string | null) {
  const ok = !!origin && allowedOrigins.some((pattern) => pattern.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "https://mentionloom.vercel.app",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function clean(value: unknown, max = 100) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Validate once, then persist the website in the same insert as the email.
// Old cached clients remain compatible; the new two-field form requires it.
function signupWebsite(value: unknown, required: boolean) {
  const website = typeof value === "string" ? value.trim() : "";
  if (!website && !required && (value === undefined || value === null || value === "")) return "";
  try {
    if (!website || website.length > 300 || /[\s<>\\]/.test(website)) throw new Error();
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    const labels = url.hostname.split(".");
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
        labels.length < 2 || url.hostname.length > 253 ||
        !labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw new Error();
    return url.origin;
  } catch {
    throw { status: 400, message: "Enter a valid website, such as company.com." };
  }
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SERVICE_ROLE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function tokenFor(id: string, nonce: string) {
  const payload = `${id}.${nonce}`;
  return `${payload}.${await hmac("manage:" + payload)}`;
}

async function parseToken(token: unknown) {
  if (typeof token !== "string" || token.length > 220) throw { status: 401, message: "This signup link is not valid." };
  const parts = token.split(".");
  if (parts.length !== 3) throw { status: 401, message: "This signup link is not valid." };
  const [id, nonce, signature] = parts;
  if (!/^[a-f0-9]{64}$/.test(id) || !/^[a-f0-9-]{36}$/i.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) {
    throw { status: 401, message: "This signup link is not valid." };
  }
  const expected = await hmac(`manage:${id}.${nonce}`);
  if (expected !== signature) throw { status: 401, message: "This signup link is not valid." };
  return { id, nonce };
}

async function owned(token: unknown) {
  const { id, nonce } = await parseToken(token);
  const { data, error } = await db
    .from("waitlist_signups")
    .select("id,email,owner_hash,stage,profile")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.owner_hash !== await sha256(nonce)) throw { status: 404, message: "This signup is no longer available." };
  return data;
}

async function rateLimit(req: Request) {
  const rawIp = clean(
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    "unknown",
    80,
  );
  const ipHash = await hmac("ip:" + rawIp);
  const windowId = Math.floor(Date.now() / 900000);

  const { data, error } = await db
    .from("waitlist_rate_limits")
    .select("count")
    .eq("ip_hash", ipHash)
    .eq("window_id", windowId)
    .maybeSingle();
  if (error) throw error;
  const count = data?.count ?? 0;
  if (count >= 12) throw { status: 429, message: "A few too many attempts. Please try again in 15 minutes." };

  const { error: upsertError } = await db
    .from("waitlist_rate_limits")
    .upsert(
      { ip_hash: ipHash, window_id: windowId, count: count + 1, updated_at: new Date().toISOString() },
      { onConflict: "ip_hash,window_id" },
    );
  if (upsertError) throw upsertError;
}

async function signup(body: any, req: Request) {
  if (clean(body.company_fax)) return { ok: true, token: null };
  const email = clean(body.email, 255).toLowerCase();
  if (!/^[^\s@<>]{1,64}@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(email) || email.length > 254) {
    throw { status: 400, message: "Enter a valid email address." };
  }
  if (body.consent !== true) throw { status: 400, message: "Please agree to receive early-access updates." };
  const website = signupWebsite(body.website, body.formVersion === "email-website-v1");
  const nonce = clean(body.requestId, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(nonce)) {
    throw { status: 400, message: "Please refresh the page and try again." };
  }

  await rateLimit(req);
  const id = await sha256(email);
  const ownerHash = await sha256(nonce);
  const now = new Date().toISOString();
  const attribution: Record<string, string> = {};
  for (const name of ["utm_source", "utm_medium", "utm_campaign", "ref"]) {
    const value = clean(body.attribution?.[name], 100);
    if (value) attribution[name] = value;
  }
  try {
    const referrer = new URL(body.attribution?.referrer);
    attribution.referrer = referrer.hostname;
  } catch {}

  const source = /^[a-z0-9-]{1,40}$/i.test(clean(body.source, 40)) ? clean(body.source, 40) : "direct";

  const { data: existing, error: readError } = await db
    .from("waitlist_signups")
    .select("owner_hash")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw readError;

  if (!existing) {
    const { error } = await db.from("waitlist_signups").insert({
      id,
      email,
      owner_hash: ownerHash,
      source,
      attribution,
      consent: { text: consentText, version: "2026-09-21", at: now },
      stage: "joined",
      profile: website ? { website } : null,
      created_at: now,
      updated_at: now,
    });
    if (error && error.code !== "23505") throw error;
  }

  const { data: persisted, error: persistedError } = await db
    .from("waitlist_signups")
    .select("email,owner_hash,profile")
    .eq("id", id)
    .single();
  if (persistedError || persisted?.email !== email) throw persistedError || new Error("Waitlist persistence verification failed.");

  // An idempotent retry may finish an older signup or correct its website.
  // Never let somebody who only knows an email overwrite another signup.
  if (website && persisted.owner_hash === ownerHash && persisted.profile?.website !== website) {
    const { data: updated, error: updateError } = await db
      .from("waitlist_signups")
      .update({ profile: { ...(persisted.profile || {}), website }, updated_at: now })
      .eq("id", id)
      .eq("owner_hash", ownerHash)
      .select("profile")
      .single();
    if (updateError || updated?.profile?.website !== website) {
      throw updateError || new Error("Waitlist website persistence verification failed.");
    }
  }

  return {
    ok: true,
    token: persisted.owner_hash === ownerHash ? await tokenFor(id, nonce) : null,
  };
}

async function profile(body: any, req: Request) {
  const current = await owned(body.token);
  await rateLimit(req);
  const website = clean(body.website, 300);
  let normalized = "";
  if (website) {
    try {
      const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
      if (!["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password || /[\s<>]/.test(website)) throw new Error();
      normalized = url.origin;
    } catch {
      throw { status: 400, message: "Enter a website such as company.com, or leave it blank." };
    }
  }
  const roles = ["founder", "marketing", "agency", "other"];
  const goals = ["visibility", "traffic", "improvements"];
  const urgencies = ["now", "soon", "exploring"];
  const tracking = ["nothing", "manual", "tool", "agency"];
  if (body.role && !roles.includes(body.role)) throw { status: 400, message: "Choose one of the roles shown." };
  if (body.goal && !goals.includes(body.goal)) throw { status: 400, message: "Choose one of the goals shown." };
  if (body.urgency && !urgencies.includes(body.urgency)) throw { status: 400, message: "Choose one of the timing options shown." };
  if (body.tracking && !tracking.includes(body.tracking)) throw { status: 400, message: "Choose one of the tracking options shown." };

  const values = {
    website: normalized,
    role: body.role || "",
    goal: body.goal || "",
    urgency: body.urgency || "",
    tracking: body.tracking || "",
  };
  if (!Object.values(values).some(Boolean)) return { ok: true };

  const { error } = await db
    .from("waitlist_signups")
    .update({
      profile: values,
      stage: "qualified",
      qualified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id);
  if (error) throw error;
  return { ok: true };
}

async function remove(body: any) {
  const { id, nonce } = await parseToken(body.token);
  const { data, error } = await db.from("waitlist_signups").select("owner_hash").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return { ok: true };
  if (data.owner_hash !== await sha256(nonce)) throw { status: 404, message: "This signup is no longer available." };
  const { error: deleteError } = await db.from("waitlist_signups").delete().eq("id", id);
  if (deleteError) throw deleteError;
  return { ok: true };
}

async function status(body: any) {
  await owned(body.token);
  return { ok: true };
}

async function legacy(body: any) {
  const response = await fetch("https://mentionloom.vercel.app/api/waitlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://mentionloom.vercel.app",
    },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try { data = await response.json(); } catch {}
  if (!response.ok || !data?.ok) {
    throw {
      status: response.status || 503,
      message: data?.error || "This signup is no longer available.",
    };
  }
  return data;
}

async function manageWithLegacy(body: any, action: () => Promise<any>) {
  try {
    return await action();
  } catch (error: any) {
    if (Number(error?.status) !== 401) throw error;
    return await legacy(body);
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json(405, { ok: false, error: "Use the signup form to join the waitlist." }, origin);

  if (!origin || !allowedOrigins.some((pattern) => pattern.test(origin))) {
    return json(403, { ok: false, error: "Please use the form on the Mentionloom website." }, origin);
  }
  if (!/^application\/json(?:;|$)/i.test(req.headers.get("content-type") || "")) {
    return json(415, { ok: false, error: "Please refresh the page and try again." }, origin);
  }

  try {
    const text = await req.text();
    if (text.length > 4096) throw { status: 413, message: "That request is too large." };
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw { status: 400, message: "Please refresh the page and try again." };
    if (!["signup", "profile", "remove", "status"].includes(body.action)) throw { status: 400, message: "This action is not supported." };

    let result;
    if (body.action === "signup") result = await signup(body, req);
    else if (body.action === "profile") result = await manageWithLegacy(body, () => profile(body, req));
    else if (body.action === "remove") result = await manageWithLegacy(body, () => remove(body));
    else result = await manageWithLegacy(body, () => status(body));

    return json(200, result, origin);
  } catch (error: any) {
    const statusCode = Number(error?.status) || 503;
    const message = error?.message || "We couldn’t save that just now. Please try again in a moment.";
    console.error("waitlist edge error", error?.name || "Error", statusCode);
    return json(statusCode, { ok: false, error: message }, origin);
  }
});
