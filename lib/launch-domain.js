export const STAGES = Object.freeze(["discovery", "comparison", "decision"]);
export const OPENAI_MODEL = "gpt-6-luna";
export const PERPLEXITY_MODEL = "perplexity/sonar";

// Published USD rates, captured 2026-09-26. Costs are stored as integer
// micro-USD; provider price changes must update this table with the model.
const COST_RATES = Object.freeze({
  openai: { inputMicrousdPerToken: 0.1, cachedInputMicrousdPerToken: 0.01, cacheWriteMicrousdPerToken: 0.125, outputMicrousdPerToken: 0.5, searchMicrousd: 10_000 },
  perplexity: { inputMicrousdPerToken: 0.25, outputMicrousdPerToken: 2.5, searchMicrousd: 0 },
});

export function validateWebsiteUrl(value) {
  let input = String(value || "").trim();
  if (!input) throw new TypeError("Enter your company website.");
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(input)) input = `https://${input}`;

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new TypeError("Enter a valid company website.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const privateHost =
    !hostname.includes(".") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".test") ||
    hostname.includes(":") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);

  if (url.protocol !== "https:" || url.username || url.password || url.port || privateHost) {
    throw new TypeError("Use a public HTTPS website without a custom port.");
  }

  url.hash = "";
  return url.toString();
}

export function websiteTextFromHtml(html) {
  const source = String(html || "").slice(0, 1_000_000);
  const title = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const description =
    source.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] ||
    source.match(/<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i)?.[1] ||
    source.match(/<meta\b[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] ||
    "";
  const visible = source
    .replace(/<(script|style|svg|noscript|template|title|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300),
    description: description.trim().slice(0, 1000),
    text: visible.slice(0, 24_000),
  };
}

export function normalizeProfile(profile = {}) {
  const text = (value, max = 400) => String(value || "").trim().slice(0, max);
  const list = (value, maxItems = 20) => {
    const items = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
    return [...new Set(items.map((item) => text(item, 180)).filter(Boolean))].slice(0, maxItems);
  };
  const competitors = (Array.isArray(profile.competitors) ? profile.competitors : [])
    .map((item) => ({
      name: text(item?.name, 120),
      website: text(item?.website, 300),
    }))
    .filter((item) => item.name)
    .slice(0, 12);

  return {
    products: list(profile.products),
    services: list(profile.services),
    category: text(profile.category, 180),
    useCases: list(profile.useCases),
    targetAudiences: list(profile.targetAudiences),
    markets: list(profile.markets, 12),
    languages: list(profile.languages, 12),
    keyClaims: list(profile.keyClaims),
    pricingHints: list(profile.pricingHints),
    competitors,
  };
}

export function validateQuestionSet(questions, { minCount = 20, maxCount = 25, minPerStage = 4 } = {}) {
  if (!Array.isArray(questions) || questions.length < minCount || questions.length > maxCount) {
    throw new TypeError(`Keep between ${minCount} and ${maxCount} buyer questions.`);
  }

  const normalized = questions.map((question) => ({
    id: question?.id ? String(question.id) : null,
    stage: String(question?.stage || question?.intent_stage || "").toLowerCase(),
    text: String(question?.text || "").trim().replace(/\s+/g, " ").slice(0, 280),
  }));
  const counts = Object.fromEntries(STAGES.map((stage) => [stage, 0]));
  const seen = new Set();

  for (const question of normalized) {
    if (question.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(question.id)) {
      throw new TypeError("A question has an invalid identifier. Reload the page and try again.");
    }
    if (!STAGES.includes(question.stage)) throw new TypeError("Choose Discovery, Comparison, or Decision for each question.");
    if (question.text.length < 12) throw new TypeError("Each buyer question needs at least 12 characters.");
    const key = question.text.toLocaleLowerCase();
    if (seen.has(key)) throw new TypeError("Remove duplicate buyer questions before continuing.");
    seen.add(key);
    if (question.id && normalized.filter((item) => item.id === question.id).length > 1) {
      throw new TypeError("A buyer question appears more than once.");
    }
    counts[question.stage] += 1;
  }

  if (STAGES.some((stage) => counts[stage] < minPerStage)) {
    throw new TypeError(`Include at least ${minPerStage} questions in each buyer stage.`);
  }
  return normalized;
}

function entityPattern(name) {
  const tokens = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const pattern = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\W]+");
  return new RegExp(`(?:^|[^a-z0-9])${pattern}(?:$|[^a-z0-9])`, "i");
}

function entityState(text, name) {
  const pattern = entityPattern(name);
  if (!pattern || !pattern.test(text)) return "absent";

  const phrase = /\b(?:recommend(?:s|ed|ing)?|top choice|best choice|clear choice|strong choice|prefer(?:s|red)?|should choose|choose)\b/i;
  const shortlist = /\b(?:shortlist(?:ed)?|finalist|top picks?|top options?|ranked?\s*(?:#?\s*1|first|number one))\b/i;
  const snippets = String(text).split(/(?<=[.!?])\s+|\n+/);
  const mentions = snippets.filter((snippet) => pattern.test(snippet));
  if (mentions.some((snippet) => phrase.test(snippet))) return "recommended";
  if (mentions.some((snippet) => shortlist.test(snippet))) return "shortlisted";
  return "mentioned";
}

export function classifyAnswer(text, brandName, competitors = []) {
  const rawText = String(text || "");
  const brandState = entityState(rawText, brandName);
  const competitorStates = Object.fromEntries(competitors.map((competitor) => {
    const name = typeof competitor === "string" ? competitor : competitor?.name;
    return [name, entityState(rawText, name)];
  }).filter(([name]) => Boolean(name)));
  const evidence = {
    classifierVersion: "mentionloom-rules-1.0",
    brandName,
    brandState,
    matchedCompetitors: Object.entries(competitorStates)
      .filter(([, state]) => state !== "absent")
      .map(([name, state]) => ({ name, state })),
  };
  const confidence = brandState === "recommended" ? 0.85 : brandState === "shortlisted" ? 0.8 : brandState === "mentioned" ? 0.7 : 0.65;
  return { brandState, competitorStates, confidence, evidence };
}

export function providerCostMicrousd({ provider, inputTokens = 0, cachedInputTokens = 0, cacheWriteTokens = 0, outputTokens = 0, searchCalls = 0 }) {
  const rates = COST_RATES[provider];
  if (!rates) throw new TypeError("Unsupported provider for cost calculation.");
  const input = Math.max(0, Number(inputTokens) || 0);
  const cachedInput = Math.min(input, Math.max(0, Number(cachedInputTokens) || 0));
  const cacheWrites = Math.max(0, Number(cacheWriteTokens) || 0);
  const uncachedInput = Math.max(0, input - cachedInput - cacheWrites);
  const output = Math.max(0, Number(outputTokens) || 0);
  const calls = Math.max(0, Number(searchCalls) || 0);
  return Math.round(
    uncachedInput * rates.inputMicrousdPerToken +
    cachedInput * (rates.cachedInputMicrousdPerToken ?? rates.inputMicrousdPerToken) +
    cacheWrites * (rates.cacheWriteMicrousdPerToken ?? rates.inputMicrousdPerToken) +
    output * rates.outputMicrousdPerToken +
    calls * rates.searchMicrousd,
  );
}

export function citationUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
