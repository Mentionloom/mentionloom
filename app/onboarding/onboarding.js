import {
  icon,
  initializeOrbit,
  toast,
  load,
  store,
} from "../lib/ui.js";

const STORAGE_KEY = "onboarding-prototype-v2";
const stageRoot = document.querySelector("#onboarding-stage");
const progressRoot = document.querySelector("#progress-nav");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const PROVIDERS = [
  { id: "openai", name: "OpenAI", asset: "chatgpt" },
  { id: "claude", name: "Claude", asset: "claude" },
  { id: "gemini", name: "Gemini", asset: "gemini" },
  { id: "perplexity", name: "Perplexity", asset: "perplexity" },
];

const RESEARCH_TASKS = [
  "Reading company pages",
  "Identifying products",
  "Detecting target audiences",
  "Mapping use cases",
  "Understanding positioning",
  "Finding likely competitors",
  "Building your company profile",
];

const MILESTONES = [
  { label: "Website", step: 1 },
  { label: "Company", step: 3 },
  { label: "Competitors", step: 4 },
  { label: "Questions", step: 5 },
  { label: "Baseline", step: 6 },
  { label: "Results", step: 8 },
];

let researchTimer = null;
let runTimer = null;
let questionFilter = "All";
let state = restoreState();

function freshState() {
  return {
    step: 1,
    maxUnlocked: 1,
    website: "",
    websiteError: "",
    researchIndex: 0,
    company: null,
    competitors: [],
    questions: [],
    run: {
      status: "idle",
      providerCounts: [0, 0, 0, 0],
    },
    evidenceOpen: false,
    opportunityOpen: false,
  };
}

function restoreState() {
  const saved = load(STORAGE_KEY, null);
  if (
    !saved ||
    typeof saved !== "object" ||
    !Number.isInteger(saved.step) ||
    !saved.run
  ) {
    return freshState();
  }
  saved.websiteError = "";
  saved.evidenceOpen = false;
  saved.opportunityOpen = false;
  return saved;
}

function save() {
  store(STORAGE_KEY, state);
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function titleCase(value) {
  return String(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    });
}

function normalizeWebsite(value) {
  let candidate = String(value || "").trim();
  if (!candidate) throw new Error("Enter a company website.");
  if (!/^https?:\/\//i.test(candidate)) candidate = "https://" + candidate;
  const url = new URL(candidate);
  if (!url.hostname || !url.hostname.includes(".")) {
    throw new Error("Enter a valid public website.");
  }
  return url.origin;
}

function brandFromWebsite(website) {
  const host = new URL(website).hostname.replace(/^www\./, "");
  const first = host.split(".")[0] || "Company";
  if (/mentionloom/i.test(host)) return "Mentionloom";
  if (/piperai/i.test(host)) return "PiperAI";
  if (/factorial/i.test(host)) return "Factorial";
  return titleCase(first);
}

function mentionloomProfile(website) {
  return {
    brand: "Mentionloom",
    website: website,
    description:
      "AI Recommendation Intelligence for B2B SaaS teams that want to understand where AI recommends them, where competitors win, and what evidence to improve.",
    products: [
      "AI Recommendation measurement",
      "Citation intelligence",
      "Competitor comparison",
      "Opportunity and re-measurement workflow",
    ],
    category: "AI Recommendation Intelligence",
    audiences: [
      "B2B SaaS founders",
      "Heads of Growth",
      "SEO and Content leads",
    ],
    useCases: [
      "Measure AI Recommendation Share",
      "Find buyer questions lost to competitors",
      "Inspect recommendation evidence and citations",
      "Prioritize improvements and re-measure",
    ],
    country: "United States",
    language: "English",
    claims: [
      "Measure recommendation visibility rather than generic mentions",
      "Trace dashboard metrics back to raw answers and citations",
      "Separate answer recommendations, referrals, and crawler activity",
    ],
    pricing: "Founding beta direction: approximately EUR 99/month",
    importantUseCase:
      "B2B SaaS growth teams evaluating where AI engines recommend their company instead of competitors.",
  };
}

function piperProfile(website) {
  return {
    brand: "PiperAI",
    website: website,
    description:
      "AI meeting and communication assistant that captures calls, meetings, email and calendar context to automate notes and follow-up workflows.",
    products: [
      "Meeting capture",
      "AI notes and reports",
      "Follow-up automation",
      "Team rules and templates",
    ],
    category: "AI Meeting Assistant",
    audiences: [
      "Revenue teams",
      "Operations teams",
      "Customer-facing teams",
    ],
    useCases: [
      "Capture meeting notes automatically",
      "Generate follow-up emails",
      "Standardize meeting and note templates",
      "Apply team-level recording rules",
    ],
    country: "United States",
    language: "English",
    claims: [
      "Automate post-meeting work",
      "Keep team meeting output consistent",
      "Connect meeting intelligence to CRM workflows",
    ],
    pricing: "Pricing to confirm",
    importantUseCase:
      "Operational teams choosing an AI meeting assistant that can standardize notes, reports and follow-up workflows.",
  };
}

function genericProfile(website) {
  const brand = brandFromWebsite(website);
  return {
    brand: brand,
    website: website,
    description:
      brand +
      " is a B2B software product. Review this generated profile before measurement begins.",
    products: [brand + " platform", brand + " analytics"],
    category: "B2B Software",
    audiences: ["Growth leaders", "Operations teams", "Product teams"],
    useCases: [
      "Evaluate software options",
      "Compare vendors",
      "Understand product capabilities",
      "Make a purchase decision",
    ],
    country: "United States",
    language: "English",
    claims: [
      "Primary product positioning to confirm",
      "Main buyer outcomes to confirm",
    ],
    pricing: "Pricing to confirm",
    importantUseCase:
      "Buyers evaluating " + brand + " against other B2B software options.",
  };
}

function suggestedCompetitors(company) {
  if (company.brand === "Mentionloom") {
    return [
      {
        name: "Profound",
        reason: "AI visibility and enterprise answer-engine analytics",
        selected: true,
      },
      {
        name: "Peec AI",
        reason: "AI search visibility and brand monitoring",
        selected: true,
      },
      {
        name: "Otterly.AI",
        reason: "AI search monitoring and prompt tracking",
        selected: true,
      },
      {
        name: "Goodie AI",
        reason: "AI search optimization and visibility measurement",
        selected: true,
      },
      {
        name: "Scrunch AI",
        reason: "AI search presence and brand intelligence",
        selected: false,
      },
    ];
  }

  if (company.brand === "PiperAI") {
    return [
      {
        name: "Fathom",
        reason: "AI meeting notes and follow-up automation",
        selected: true,
      },
      {
        name: "Fireflies.ai",
        reason: "Meeting transcription and conversation intelligence",
        selected: true,
      },
      {
        name: "Otter.ai",
        reason: "AI meeting transcription and notes",
        selected: true,
      },
      {
        name: "Granola",
        reason: "AI-assisted meeting notes",
        selected: true,
      },
      {
        name: "Avoma",
        reason: "Meeting intelligence and revenue workflows",
        selected: false,
      },
    ];
  }

  return [
    {
      name: "Category leader",
      reason: "Large incumbent competing for the same buyer problem",
      selected: true,
    },
    {
      name: "Direct alternative",
      reason: "Similar product and audience",
      selected: true,
    },
    {
      name: "Specialist competitor",
      reason: "Focused alternative for a narrower use case",
      selected: true,
    },
    {
      name: "Adjacent platform",
      reason: "Broader suite that can substitute for this product",
      selected: false,
    },
  ];
}

function mentionloomQuestions() {
  const rows = [
    ["What are the best tools for measuring whether AI recommends my brand?", "Discovery"],
    ["How can I track brand recommendations in ChatGPT, Claude, Gemini, and Perplexity?", "Discovery"],
    ["How do I know which buyer questions AI recommends my competitors for?", "Discovery"],
    ["What tools show citations behind AI recommendations?", "Discovery"],
    ["How can B2B SaaS companies improve visibility in AI recommendations?", "Discovery"],
    ["How can I measure AI recommendation share over time?", "Discovery"],
    ["What is the difference between AI visibility and AI recommendation share?", "Discovery"],
    ["How can I identify content gaps associated with competitor recommendations in AI?", "Discovery"],
    ["Mentionloom vs Profound for AI recommendation intelligence", "Comparison"],
    ["Mentionloom vs Peec AI", "Comparison"],
    ["Mentionloom vs Otterly AI", "Comparison"],
    ["Best alternatives to Profound for B2B SaaS", "Comparison"],
    ["Best AI recommendation monitoring tools for small SaaS teams", "Comparison"],
    ["Which AI visibility tools preserve raw answers and citations?", "Comparison"],
    ["Which tools compare recommendation visibility across ChatGPT, Claude, Gemini, and Perplexity?", "Comparison"],
    ["Which AI search monitoring tools compare a brand with competitors?", "Comparison"],
    ["Is Mentionloom good for B2B SaaS growth teams?", "Decision"],
    ["How does Mentionloom calculate AI Recommendation Share?", "Decision"],
    ["Does Mentionloom keep the raw AI answers and citations behind metrics?", "Decision"],
    ["Can Mentionloom show questions where competitors are recommended instead?", "Decision"],
    ["Does Mentionloom require GA4 or Search Console before the first baseline?", "Decision"],
    ["Which AI engines does Mentionloom measure?", "Decision"],
    ["Can Mentionloom re-measure after content changes?", "Decision"],
    ["How much does Mentionloom cost?", "Decision"],
  ];
  return rows.map(function (row, index) {
    return {
      id: "q" + (index + 1),
      text: row[0],
      intent: row[1],
      selected: true,
    };
  });
}

function genericQuestions(company, competitors) {
  const brand = company.brand;
  const category = company.category.toLowerCase();
  const selected = competitors.filter(function (item) {
    return item.selected;
  });
  const first = selected[0] ? selected[0].name : "a leading competitor";
  const second = selected[1] ? selected[1].name : "another alternative";
  const rows = [
    ["What are the best " + category + " tools?", "Discovery"],
    ["Which " + category + " platforms are best for growing teams?", "Discovery"],
    ["How do teams evaluate " + category + " software?", "Discovery"],
    ["What should I look for when choosing " + category + " software?", "Discovery"],
    ["Which tools solve " + company.useCases[0].toLowerCase() + "?", "Discovery"],
    ["Best software for " + company.audiences[0].toLowerCase(), "Discovery"],
    ["What are the most trusted " + category + " platforms?", "Discovery"],
    ["Which " + category + " tools have the strongest integrations?", "Discovery"],
    [brand + " vs " + first, "Comparison"],
    [brand + " vs " + second, "Comparison"],
    ["Best alternatives to " + first, "Comparison"],
    ["Best alternatives to " + brand, "Comparison"],
    ["Which is better for growing teams: " + brand + " or " + first + "?", "Comparison"],
    ["Compare pricing for " + brand + " and " + first, "Comparison"],
    ["Which " + category + " platform is easiest to adopt?", "Comparison"],
    ["Which " + category + " platform is best for B2B teams?", "Comparison"],
    ["Is " + brand + " good for " + company.audiences[0].toLowerCase() + "?", "Decision"],
    ["How much does " + brand + " cost?", "Decision"],
    ["What are the limitations of " + brand + "?", "Decision"],
    ["Does " + brand + " support enterprise teams?", "Decision"],
    ["What integrations does " + brand + " support?", "Decision"],
    ["Is " + brand + " easy to set up?", "Decision"],
    ["Is " + brand + " worth the price?", "Decision"],
    ["Who should choose " + brand + "?", "Decision"],
  ];
  return rows.map(function (row, index) {
    return {
      id: "q" + (index + 1),
      text: row[0],
      intent: row[1],
      selected: true,
    };
  });
}

function contextForWebsite(website) {
  const host = new URL(website).hostname;
  let company;
  if (/mentionloom/i.test(host)) company = mentionloomProfile(website);
  else if (/piperai/i.test(host)) company = piperProfile(website);
  else company = genericProfile(website);
  const competitors = suggestedCompetitors(company);
  const questions =
    company.brand === "Mentionloom"
      ? mentionloomQuestions()
      : genericQuestions(company, competitors);
  return { company: company, competitors: competitors, questions: questions };
}

function currentMilestoneStep() {
  if (state.step <= 1) return 1;
  if (state.step <= 3) return 3;
  if (state.step === 4) return 4;
  if (state.step === 5) return 5;
  if (state.step <= 7) return 6;
  return 8;
}

function renderProgress() {
  const current = currentMilestoneStep();
  progressRoot.innerHTML = MILESTONES.map(function (item, index) {
    const isCurrent = item.step === current;
    const isComplete = item.step < current && item.step <= state.maxUnlocked;
    const canVisit = isComplete;
    const className =
      "progress-step" +
      (isCurrent ? " is-current" : "") +
      (isComplete ? " is-complete" : "");
    const number = isComplete ? icon("check") : String(index + 1);
    return (
      '<button class="' +
      className +
      '" type="button" data-progress-target="' +
      item.step +
      '"' +
      (canVisit ? "" : " disabled") +
      '><span>' +
      number +
      "</span><span>" +
      esc(item.label) +
      "</span></button>"
    );
  }).join("");
}

function stageHeading(number, title, description) {
  return (
    '<div class="stage-heading">' +
    '<div class="stage-kicker"><span class="stage-number">' +
    number +
    "</span><span>Company onboarding</span></div>" +
    "<h1>" +
    esc(title) +
    "</h1>" +
    "<p>" +
    esc(description) +
    "</p>" +
    "</div>"
  );
}

function footer(backLabel, nextLabel, nextAction, copy) {
  return (
    '<div class="stage-footer">' +
    '<div class="stage-footer-copy">' +
    esc(copy || "") +
    "</div>" +
    '<div class="stage-actions">' +
    (backLabel
      ? '<button class="button ghost" type="button" data-action="back">' +
        esc(backLabel) +
        "</button>"
      : "") +
    (nextLabel
      ? '<button class="button primary" type="button" data-action="' +
        nextAction +
        '">' +
        esc(nextLabel) +
        " " +
        icon("right") +
        "</button>"
      : "") +
    "</div></div>"
  );
}

function renderWebsite() {
  return (
    '<div class="onboarding-stage">' +
    stageHeading(
      "01",
      "Understand how AI recommends your company",
      "Start with your website. Mentionloom will propose your company profile, likely competitors and a buyer-question measurement set for you to review."
    ) +
    '<section class="stage-surface"><div class="stage-body">' +
    '<form class="hero-input" data-form="website" novalidate>' +
    '<label class="form-field"><span class="sr-only">Company website</span>' +
    '<div class="domain-shell">' +
    '<input type="url" name="website" autocomplete="url" placeholder="https://mentionloom.vercel.app" value="' +
    esc(state.website) +
    '" aria-invalid="' +
    String(Boolean(state.websiteError)) +
    '" />' +
    '<button class="button primary" type="submit">Analyze company ' +
    icon("right") +
    "</button></div>" +
    (state.websiteError
      ? '<span class="form-error">' + esc(state.websiteError) + "</span>"
      : "") +
    "</label></form>" +
    '<div class="onboarding-reassurance">' +
    "<span>" +
    icon("check") +
    "No analytics integration</span>" +
    "<span>" +
    icon("check") +
    "No provider API keys</span>" +
    "<span>" +
    icon("check") +
    "Review before measurement</span>" +
    "</div></div>" +
    '<div class="stage-footer"><div class="stage-footer-copy">One field first. Market and language are inferred and confirmed later.</div></div>' +
    "</section>" +
    '<p class="prototype-boundary">Prototype route: generated company intelligence and measurement results are simulated for UX testing.</p>' +
    "</div>"
  );
}

function renderResearch() {
  const rows = RESEARCH_TASKS.map(function (task, index) {
    const done = index < state.researchIndex;
    const active = index === state.researchIndex && state.researchIndex < RESEARCH_TASKS.length;
    return (
      '<div class="research-row' +
      (done ? " is-complete" : "") +
      (active ? " is-active" : "") +
      '">' +
      '<span class="research-status">' +
      (done ? icon("check") : active ? '<span class="spinner"></span>' : "") +
      "</span><span>" +
      esc(task) +
      "</span></div>"
    );
  }).join("");
  return (
    '<div class="onboarding-stage">' +
    stageHeading(
      "02",
      "Understanding your company",
      "Analyzing " + state.website + ". Mentionloom is turning the public site into a structured company profile instead of asking you to configure everything manually."
    ) +
    '<section class="stage-surface"><div class="stage-body">' +
    '<div class="research-layout"><div class="research-list">' +
    rows +
    '</div><div class="research-preview" aria-hidden="true">' +
    '<div class="research-browser"><div class="research-browser-top"><span></span><span></span><span></span></div>' +
    '<div class="research-skeleton"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>' +
    "</div></div></div></div>" +
    footer("Back", "", "", "You will be able to edit every inferred field before measurement.") +
    "</section></div>"
  );
}

function listValue(items) {
  return Array.isArray(items) ? items.join("\n") : "";
}

function profileField(label, key, value, options) {
  const wide = options && options.wide ? " wide" : "";
  const list = options && options.list;
  const hint = options && options.hint ? '<span class="hint">' + esc(options.hint) + "</span>" : "";
  const control = list
    ? '<textarea data-profile-list="' +
      key +
      '">' +
      esc(listValue(value)) +
      "</textarea>"
    : '<input type="text" data-profile="' +
      key +
      '" value="' +
      esc(value) +
      '" />';
  return (
    '<div class="profile-field' +
    wide +
    '"><label>' +
    esc(label) +
    "</label>" +
    control +
    hint +
    "</div>"
  );
}

function renderProfile() {
  const c = state.company;
  return (
    '<div class="onboarding-stage">' +
    stageHeading(
      "03",
      "We think we understand " + c.brand + " like this",
      "Review the generated profile. The interface is deliberately a confirmation surface, not a setup form."
    ) +
    '<section class="stage-surface"><div class="stage-body">' +
    '<div class="profile-grid">' +
    profileField("Brand", "brand", c.brand) +
    profileField("Website", "website", c.website || state.website) +
    profileField("Category", "category", c.category) +
    profileField("Description", "description", c.description, { wide: true }) +
    profileField("Products", "products", c.products, { list: true }) +
    profileField("Primary audiences", "audiences", c.audiences, { list: true }) +
    profileField("Main use cases", "useCases", c.useCases, { list: true }) +
    profileField("Current claims", "claims", c.claims, { list: true }) +
    profileField("Primary market", "country", c.country) +
    profileField("Language", "language", c.language) +
    profileField("Pricing signal", "pricing", c.pricing, { wide: true }) +
    profileField(
      "Most important buyer / use case",
      "importantUseCase",
      c.importantUseCase,
      {
        wide: true,
        hint: "This becomes an anchor when Mentionloom proposes buyer questions.",
      }
    ) +
    "</div></div>" +
    footer(
      "Back",
      "Confirm company",
      "confirm-profile",
      "Edit anything that is wrong. Mentionloom should do the research; you should only validate it."
    ) +
    "</section></div>"
  );
}

function selectedCompetitorCount() {
  return state.competitors.filter(function (item) {
    return item.selected;
  }).length;
}

function renderCompetitors() {
  const rows = state.competitors.map(function (item, index) {
    return (
      '<div class="competitor-row">' +
      '<label class="choice" aria-label="Include ' +
      esc(item.name) +
      '"><input type="checkbox" data-competitor-toggle="' +
      index +
      '"' +
      (item.selected ? " checked" : "") +
      " /></label>" +
      '<span class="competitor-name">' +
      esc(item.name) +
      "</span>" +
      '<span class="competitor-reason">' +
      esc(item.reason) +
      "</span>" +
      '<button class="icon-button" type="button" data-remove-competitor="' +
      index +
      '" aria-label="Remove ' +
      esc(item.name) +
      '">' +
      icon("close") +
      "</button></div>"
    );
  }).join("");

  return (
    '<div class="onboarding-stage">' +
    stageHeading(
      "04",
      "Who do buyers compare you with?",
      "Mentionloom proposes a small competitor set. Keep the companies that genuinely compete for the same buyer question."
    ) +
    '<section class="stage-surface"><div class="stage-body">' +
    '<div class="competitor-list">' +
    rows +
    "</div>" +
    '<div class="add-row"><input id="new-competitor" type="text" placeholder="Add a competitor" aria-label="Competitor name" />' +
    '<button class="button" type="button" data-action="add-competitor">' +
    icon("plus") +
    "Add competitor</button></div>" +
    "</div>" +
    footer(
      "Back",
      "Confirm " + selectedCompetitorCount() + " competitors",
      "confirm-competitors",
      "Three to five direct competitors is enough for the first baseline."
    ) +
    "</section></div>"
  );
}

function selectedQuestions() {
  return state.questions.filter(function (question) {
    return question.selected;
  });
}

function countIntent(intent, selectedOnly) {
  return state.questions.filter(function (question) {
    return (!selectedOnly || question.selected) && question.intent === intent;
  }).length;
}

function renderQuestionSegments() {
  const labels = ["All", "Discovery", "Comparison", "Decision"];
  return (
    '<div class="segmented" role="tablist" aria-label="Buyer question stage">' +
    labels
      .map(function (label) {
        const count =
          label === "All"
            ? state.questions.length
            : countIntent(label, false);
        return (
          '<button type="button" role="tab" data-question-filter="' +
          label +
          '" class="' +
          (questionFilter === label ? "active" : "") +
          '" aria-selected="' +
          String(questionFilter === label) +
          '">' +
          label +
          " <span>" +
          count +
          "</span></button>"
        );
      })
      .join("") +
    "</div>"
  );
}

function renderQuestions() {
  const visible = state.questions.filter(function (question) {
    return questionFilter === "All" || question.intent === questionFilter;
  });
  const rows = visible.length
    ? visible
        .map(function (question) {
          return (
            '<div class="question-row">' +
            '<label class="choice" aria-label="Include question"><input type="checkbox" data-question-toggle="' +
            question.id +
            '"' +
            (question.selected ? " checked" : "") +
            " /></label>" +
            '<input class="question-text-input" type="text" data-question-text="' +
            question.id +
            '" value="' +
            esc(question.text) +
            '" aria-label="Buyer question" />' +
            '<span class="badge intent-badge ' +
            question.intent.toLowerCase() +
            '">' +
            esc(question.intent) +
            "</span></div>"
          );
        })
        .join("")
    : '<div class="empty-filter">No questions in this stage yet.</div>';

  return (
    '<div class="onboarding-stage">' +
    stageHeading(
      "05",
      "Here are your buyer questions",
      "This is the measurement set Mentionloom will sample repeatedly across AI surfaces. It is a representative set, not observed ChatGPT query volume."
    ) +
    '<section class="stage-surface"><div class="stage-body">' +
    '<div class="question-toolbar">' +
    renderQuestionSegments() +
    '<span class="question-count">' +
    selectedQuestions().length +
    " selected</span></div>" +
    '<div class="question-list">' +
    rows +
    "</div>" +
    '<div class="add-row">' +
    '<input id="new-question" type="text" placeholder="Add a buyer question" aria-label="New buyer question" />' +
    '<select id="new-question-intent" aria-label="Question intent"><option>Discovery</option><option>Comparison</option><option>Decision</option></select>' +
    '<button class="button" type="button" data-action="add-question">' +
    icon("plus") +
    "Add question</button></div>" +
    "</div>" +
    footer(
      "Back",
      "Approve questions",
      "approve-questions",
      "You can edit the wording directly. Keep the set focused on real buying situations."
    ) +
    "</section></div>"
  );
}

function baselineCounts() {
  const selected = selectedQuestions();
  const perProvider = selected.length * 3;
  return {
    questions: selected.length,
    discovery: selected.filter(function (q) { return q.intent === "Discovery"; }).length,
    comparison: selected.filter(function (q) { return q.intent === "Comparison"; }).length,
    decision: selected.filter(function (q) { return q.intent === "Decision"; }).length,
    competitors: selectedCompetitorCount(),
    perProvider: perProvider,
    total: perProvider * PROVIDERS.length,
  };
}

function providerCompact() {
  return PROVIDERS.map(function (provider) {
    return (
      "<span><img src=\"/assets/brands/" +
      provider.asset +
      ".svg\" alt=\"\" />" +
      esc(provider.name) +
      "</span>"
    );
  }).join("");
}

function renderBaseline() {
  const counts = baselineCounts();
  return (
    '<div class="onboarding-stage">' +
    stageHeading(
      "06",
      "Your first baseline",
      "Review exactly what Mentionloom will measure before spending provider credits."
    ) +
    '<section class="stage-surface"><div class="stage-body">' +
    '<div class="baseline-grid">' +
    '<article class="baseline-card"><span>Buyer questions</span><strong>' +
    counts.questions +
    '</strong><div class="baseline-breakdown"><div><span>Discovery</span><b>' +
    counts.discovery +
    '</b></div><div><span>Comparison</span><b>' +
    counts.comparison +
    '</b></div><div><span>Decision</span><b>' +
    counts.decision +
    "</b></div></div></article>" +
    '<article class="baseline-card"><span>AI providers</span><strong>' +
    PROVIDERS.length +
    '</strong><div class="provider-list-compact">' +
    providerCompact() +
    "</div></article>" +
    '<article class="baseline-card"><span>Competitors</span><strong>' +
    counts.competitors +
    '</strong><div class="baseline-breakdown">' +
    state.competitors
      .filter(function (item) { return item.selected; })
      .map(function (item) {
        return "<div><span>" + esc(item.name) + "</span></div>";
      })
      .join("") +
    "</div></article>" +
    '<article class="baseline-card"><span>Market and language</span><strong>' +
    esc(state.company.country) +
    '</strong><div class="baseline-breakdown"><div><span>Language</span><b>' +
    esc(state.company.language) +
    "</b></div><div><span>Samples / question / provider</span><b>3</b></div></div></article>" +
    "</div>" +
    '<div class="baseline-equation">' +
    icon("info") +
    "<span><strong>" +
    counts.questions +
    " questions</strong> x <strong>" +
    PROVIDERS.length +
    " providers</strong> x <strong>3 samples</strong> = <strong>" +
    counts.total +
    " answers</strong>. Multiple samples expose answer variability.</span></div>" +
    "</div>" +
    footer(
      "Back",
      "Run baseline",
      "run-baseline",
      "Every answer and citation would be preserved as evidence in the production measurement pipeline."
    ) +
    "</section></div>"
  );
}

function totalCollected() {
  return state.run.providerCounts.reduce(function (sum, value) {
    return sum + value;
  }, 0);
}

function renderRunning() {
  const counts = baselineCounts();
  const collected = Math.min(totalCollected(), counts.total);
  const percent = counts.total
    ? Math.round((collected / counts.total) * 100)
    : 0;
  const rows = PROVIDERS.map(function (provider, index) {
    const value = Math.min(state.run.providerCounts[index] || 0, counts.perProvider);
    const rowPercent = counts.perProvider
      ? Math.round((value / counts.perProvider) * 100)
      : 0;
    return (
      '<div class="provider-progress-row' +
      (value >= counts.perProvider ? " is-complete" : "") +
      '">' +
      '<div class="provider-name"><img src="/assets/brands/' +
      provider.asset +
      '.svg" alt="" /><span>' +
      esc(provider.name) +
      "</span></div>" +
      '<div class="progress" aria-label="' +
      esc(provider.name) +
      ' progress"><span style="width:' +
      rowPercent +
      '%"></span></div>' +
      '<span class="provider-count">' +
      value +
      " / " +
      counts.perProvider +
      "</span></div>"
    );
  }).join("");

  return (
    '<div class="onboarding-stage">' +
    stageHeading(
      "07",
      "Measuring your AI Recommendation Share",
      "The production version runs approved buyer questions across explicit provider surfaces and stores every raw answer, citation and classification."
    ) +
    '<section class="stage-surface"><div class="stage-body">' +
    '<div class="run-summary"><strong>' +
    collected +
    " / " +
    counts.total +
    ' answers</strong><span>' +
    percent +
    "% complete</span></div>" +
    '<div class="progress run-progress"><span style="width:' +
    percent +
    '%"></span></div>' +
    '<div class="provider-progress-list">' +
    rows +
    "</div>" +
    '<div class="measurement-note">' +
    icon("info") +
    "<span>Recommendation state is classified as <strong>absent</strong>, <strong>mentioned</strong>, <strong>shortlisted</strong> or <strong>recommended</strong>. Named first does not automatically mean recommended.</span></div>" +
    "</div>" +
    '<div class="stage-footer"><div class="stage-footer-copy">You could leave this screen in production. The run continues in the background.</div>' +
    '<div class="stage-actions"><button class="button ghost" type="button" data-action="finish-run">Skip animation</button></div></div>' +
    "</section></div>"
  );
}

function resultQuestion() {
  const selected = selectedQuestions();
  return (
    selected.find(function (q) {
      return q.intent === "Discovery" && /best|which|tools/i.test(q.text);
    }) ||
    selected[0] || {
      text: "Which buyer questions recommend competitors instead?",
    }
  );
}

function resultCompetitors() {
  return state.competitors.filter(function (item) {
    return item.selected;
  }).slice(0, 3);
}

function renderEvidencePanel() {
  if (!state.evidenceOpen) return "";
  const comps = resultCompetitors();
  return (
    '<div class="evidence-panel">' +
    "<h3>Evidence associated with this result</h3>" +
    "<p>The prototype does not claim hidden model causality. In production, this area would expose the raw answer, citations and recurring evidence patterns connected to the recommendation state.</p>" +
    '<ul class="evidence-list">' +
    '<li>' +
    icon("link") +
    "<span>Recurring third-party comparison pages mention " +
    esc(comps[0] ? comps[0].name : "competitors") +
    " explicitly for this category.</span></li>" +
    '<li>' +
    icon("file") +
    "<span>Your own positioning is less explicit for this buyer phrasing than the recurring cited sources.</span></li>" +
    '<li>' +
    icon("layers") +
    "<span>The same pattern appears across multiple sampled answers, so it is worth investigating rather than treating one answer as causal proof.</span></li>" +
    "</ul></div>"
  );
}

function renderOpportunityPanel() {
  if (!state.opportunityOpen) return "";
  return (
    '<div class="evidence-panel">' +
    "<h3>Suggested improvement experiment</h3>" +
    "<p>Strengthen explicit category and use-case evidence on the pages most relevant to this buyer question, then pursue credible third-party comparison coverage. Save the current baseline, ship the change, and re-measure against a control set before drawing a causal conclusion.</p>" +
    '<ul class="evidence-list">' +
    '<li>' +
    icon("check") +
    "<span>Clarify category and intended buyer in primary product copy.</span></li>" +
    '<li>' +
    icon("check") +
    "<span>Add evidence that directly answers the losing buyer question.</span></li>" +
    '<li>' +
    icon("check") +
    "<span>Re-run the same question set and compare recommendation states plus uncertainty.</span></li>" +
    "</ul></div>"
  );
}

function renderResults() {
  const counts = baselineCounts();
  const recommended = Math.round(counts.total * 0.27);
  const lost = Math.round(counts.total * 0.41);
  const question = resultQuestion();
  const comps = resultCompetitors();
  const stateRows =
    '<div class="state-row"><span>' +
    esc(state.company.brand) +
    '</span><span class="state-absent">Absent</span></div>' +
    comps
      .map(function (item, index) {
        return (
          '<div class="state-row"><span>' +
          esc(item.name) +
          '</span><span class="' +
          (index === 0 ? "state-recommended" : "state-shortlisted") +
          '">' +
          (index === 0 ? "Recommended" : "Shortlisted") +
          "</span></div>"
        );
      })
      .join("");

  return (
    '<div class="onboarding-stage">' +
    stageHeading(
      "08",
      "Your first recommendation snapshot",
      "The first-value screen should immediately show where you are winning, where you are losing and what to investigate next."
    ) +
    '<div class="results-shell">' +
    '<div class="result-metrics">' +
    '<article class="result-metric positive"><span class="metric-label">AI Recommendation Share</span><strong>27%</strong><p>' +
    recommended +
    " of " +
    counts.total +
    " sampled answers shortlisted or explicitly recommended " +
    esc(state.company.brand) +
    ".</p></article>" +
    '<article class="result-metric negative"><span class="metric-label">Lost Recommendation Share</span><strong>41%</strong><p>In ' +
    lost +
    " answers, a competitor was shortlisted or recommended while " +
    esc(state.company.brand) +
    " was absent or only mentioned.</p></article>" +
    "</div>" +
    '<article class="insight-card"><span class="insight-label">Highest-impact losing question</span><h2>' +
    esc(question.text) +
    '</h2><div class="state-list">' +
    stateRows +
    '</div><div class="insight-actions"><button class="button" type="button" data-action="toggle-evidence">' +
    (state.evidenceOpen ? "Hide evidence" : "See answer and evidence") +
    " " +
    icon(state.evidenceOpen ? "up" : "down") +
    "</button></div>" +
    renderEvidencePanel() +
    "</article>" +
    '<article class="insight-card opportunity-card"><span class="insight-label">First opportunity</span><h2>Strengthen evidence for the buyer language where competitors repeatedly appear in the shortlist.</h2>' +
    '<div class="opportunity-meta"><span>' +
    icon("link") +
    "4 recurring source patterns</span><span>" +
    icon("list") +
    "7 affected questions</span><span>" +
    icon("people") +
    selectedCompetitorCount() +
    " competing brands</span></div>" +
    '<div class="insight-actions"><button class="button primary" type="button" data-action="toggle-opportunity">' +
    (state.opportunityOpen ? "Hide experiment" : "Investigate opportunity") +
    " " +
    icon(state.opportunityOpen ? "up" : "right") +
    "</button><button class=\"button ghost\" type=\"button\" data-action=\"back\">Review baseline</button></div>" +
    renderOpportunityPanel() +
    "</article>" +
    "</div>" +
    '<p class="prototype-boundary">These result values are prototype data for flow testing, not measurements from your website or live AI providers.</p>' +
    "</div>"
  );
}

function render() {
  renderProgress();
  if (state.step === 1) stageRoot.innerHTML = renderWebsite();
  else if (state.step === 2) stageRoot.innerHTML = renderResearch();
  else if (state.step === 3) stageRoot.innerHTML = renderProfile();
  else if (state.step === 4) stageRoot.innerHTML = renderCompetitors();
  else if (state.step === 5) stageRoot.innerHTML = renderQuestions();
  else if (state.step === 6) stageRoot.innerHTML = renderBaseline();
  else if (state.step === 7) stageRoot.innerHTML = renderRunning();
  else stageRoot.innerHTML = renderResults();

  stageRoot
    .querySelectorAll("[data-app-icon]")
    .forEach(function (node) {
      node.innerHTML = icon(node.dataset.appIcon);
    });

  if (state.step === 1) {
    requestAnimationFrame(function () {
      stageRoot.querySelector('input[name="website"]')?.focus();
    });
  }
}

function unlock(step) {
  state.maxUnlocked = Math.max(state.maxUnlocked || 1, step);
}

function moveTo(step) {
  clearInterval(researchTimer);
  researchTimer = null;
  if (state.step !== 7 || step !== 7) {
    clearInterval(runTimer);
    runTimer = null;
  }
  state.step = step;
  unlock(step);
  save();
  render();
  document.querySelector("#main")?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
}

function beginResearch(rawWebsite) {
  state.website = String(rawWebsite || "").trim();
  state.websiteError = "";
  save();
  try {
    const website = normalizeWebsite(state.website);
    const context = contextForWebsite(website);
    state.website = website;
    state.websiteError = "";
    state.company = context.company;
    state.competitors = context.competitors;
    state.questions = context.questions;
    state.researchIndex = 0;
    state.run = { status: "idle", providerCounts: [0, 0, 0, 0] };
    state.step = 2;
    unlock(2);
    save();
    render();
    runResearch();
  } catch (error) {
    state.websiteError = error.message || "Enter a valid website.";
    save();
    render();
  }
}

function runResearch() {
  clearInterval(researchTimer);
  const delay = reducedMotion.matches ? 70 : 430;
  researchTimer = setInterval(function () {
    state.researchIndex += 1;
    if (state.researchIndex > RESEARCH_TASKS.length) {
      clearInterval(researchTimer);
      researchTimer = null;
      state.researchIndex = RESEARCH_TASKS.length;
      moveTo(3);
      return;
    }
    save();
    render();
  }, delay);
}

function backStep() {
  const map = {
    2: 1,
    3: 1,
    4: 3,
    5: 4,
    6: 5,
    7: 6,
    8: 6,
  };
  moveTo(map[state.step] || 1);
}

function validateProfile() {
  if (!state.company.brand.trim()) {
    toast("Add a company name before continuing.");
    return false;
  }
  if (!state.company.category.trim()) {
    toast("Add a category before continuing.");
    return false;
  }
  return true;
}

function addCompetitor() {
  const input = document.querySelector("#new-competitor");
  const name = String(input?.value || "").trim();
  if (!name) {
    input?.focus();
    return;
  }
  state.competitors.push({
    name: name,
    reason: "Added by you",
    selected: true,
  });
  save();
  render();
  requestAnimationFrame(function () {
    document.querySelector("#new-competitor")?.focus();
  });
}

function addQuestion() {
  const input = document.querySelector("#new-question");
  const select = document.querySelector("#new-question-intent");
  const text = String(input?.value || "").trim();
  if (!text) {
    input?.focus();
    return;
  }
  const intent = select?.value || "Discovery";
  state.questions.push({
    id: "q-user-" + Date.now(),
    text: text,
    intent: intent,
    selected: true,
  });
  questionFilter = intent;
  save();
  render();
  requestAnimationFrame(function () {
    document.querySelector("#new-question")?.focus();
  });
}

function startBaseline() {
  const counts = baselineCounts();
  if (!counts.questions) {
    toast("Select at least one buyer question.");
    return;
  }
  if (!counts.competitors) {
    toast("Select at least one competitor.");
    return;
  }
  state.run = {
    status: "running",
    providerCounts: [0, 0, 0, 0],
  };
  state.step = 7;
  unlock(7);
  save();
  render();
  runBaseline();
}

function runBaseline() {
  clearInterval(runTimer);
  const counts = baselineCounts();
  const target = counts.perProvider;
  if (!target) return;
  const delay = reducedMotion.matches ? 25 : 72;
  let tick = 0;
  runTimer = setInterval(function () {
    tick += 1;
    const holds = [0, 5, 3, 4];
    state.run.providerCounts = state.run.providerCounts.map(function (value, index) {
      if (value >= target) return target;
      if (holds[index] && tick % holds[index] === 0) return value;
      return Math.min(target, value + 1);
    });
    if (tick % 6 === 0) save();
    render();
    const complete = state.run.providerCounts.every(function (value) {
      return value >= target;
    });
    if (complete) finishBaseline();
  }, delay);
}

function finishBaseline() {
  clearInterval(runTimer);
  runTimer = null;
  const counts = baselineCounts();
  state.run.providerCounts = PROVIDERS.map(function () {
    return counts.perProvider;
  });
  state.run.status = "complete";
  state.step = 8;
  unlock(8);
  save();
  store("first-report-dismissed", false);
  window.location.assign("/app/overview/?firstReport=1");
}

function resetPrototype() {
  clearInterval(researchTimer);
  clearInterval(runTimer);
  researchTimer = null;
  runTimer = null;
  state = freshState();
  questionFilter = "All";
  save();
  render();
  toast("Onboarding prototype reset.");
}

document.addEventListener("submit", function (event) {
  const form = event.target.closest('[data-form="website"]');
  if (!form) return;
  event.preventDefault();
  beginResearch(new FormData(form).get("website"));
});

document.addEventListener("click", function (event) {
  const progress = event.target.closest("[data-progress-target]");
  if (progress && !progress.disabled) {
    const target = Number(progress.dataset.progressTarget);
    if (target <= state.maxUnlocked) moveTo(target);
    return;
  }

  const removeCompetitor = event.target.closest("[data-remove-competitor]");
  if (removeCompetitor) {
    state.competitors.splice(Number(removeCompetitor.dataset.removeCompetitor), 1);
    save();
    render();
    return;
  }

  const filterButton = event.target.closest("[data-question-filter]");
  if (filterButton) {
    questionFilter = filterButton.dataset.questionFilter;
    render();
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "reset") resetPrototype();
  else if (action === "back") backStep();
  else if (action === "confirm-profile") {
    if (validateProfile()) moveTo(4);
  } else if (action === "add-competitor") addCompetitor();
  else if (action === "confirm-competitors") {
    if (!selectedCompetitorCount()) toast("Select at least one competitor.");
    else moveTo(5);
  } else if (action === "add-question") addQuestion();
  else if (action === "approve-questions") {
    if (!selectedQuestions().length) toast("Select at least one buyer question.");
    else moveTo(6);
  } else if (action === "run-baseline") startBaseline();
  else if (action === "finish-run") finishBaseline();
  else if (action === "toggle-evidence") {
    state.evidenceOpen = !state.evidenceOpen;
    save();
    render();
  } else if (action === "toggle-opportunity") {
    state.opportunityOpen = !state.opportunityOpen;
    save();
    render();
  }
});

document.addEventListener("change", function (event) {
  const competitorToggle = event.target.closest("[data-competitor-toggle]");
  if (competitorToggle) {
    const index = Number(competitorToggle.dataset.competitorToggle);
    state.competitors[index].selected = competitorToggle.checked;
    save();
    render();
    return;
  }

  const questionToggle = event.target.closest("[data-question-toggle]");
  if (questionToggle) {
    const question = state.questions.find(function (item) {
      return item.id === questionToggle.dataset.questionToggle;
    });
    if (question) {
      question.selected = questionToggle.checked;
      save();
      render();
    }
  }
});

document.addEventListener("input", function (event) {
  if (event.target.matches('input[name="website"]')) {
    state.website = event.target.value;
    state.websiteError = "";
    save();
    return;
  }

  const profile = event.target.closest("[data-profile]");
  if (profile) {
    state.company[profile.dataset.profile] = profile.value;
    save();
    return;
  }

  const profileList = event.target.closest("[data-profile-list]");
  if (profileList) {
    state.company[profileList.dataset.profileList] = profileList.value
      .split("\n")
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
    save();
    return;
  }

  const questionText = event.target.closest("[data-question-text]");
  if (questionText) {
    const question = state.questions.find(function (item) {
      return item.id === questionText.dataset.questionText;
    });
    if (question) {
      question.text = questionText.value;
      save();
    }
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key !== "Enter") return;
  if (event.target.id === "new-competitor") {
    event.preventDefault();
    addCompetitor();
  }
  if (event.target.id === "new-question") {
    event.preventDefault();
    addQuestion();
  }
});

await initializeOrbit();
render();

if (state.step === 2 && state.researchIndex < RESEARCH_TASKS.length) {
  runResearch();
} else if (state.step === 2) {
  moveTo(3);
} else if (state.step === 7 && state.run.status === "running") {
  runBaseline();
}
