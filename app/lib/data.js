// Deterministic sample workspace. No production analytics or private AI conversations.
export const END = "2026-09-09";
export const DAY = 86400000;
export const ENGINES = [
  { id: "chatgpt", name: "ChatGPT", symbol: "gpt", color: "green", rate: 0.13 },
  {
    id: "perplexity",
    name: "Perplexity",
    symbol: "perplexity",
    color: "sky",
    rate: 0.04,
  },
  {
    id: "claude",
    name: "Claude",
    symbol: "claude",
    color: "orange",
    rate: -0.03,
  },
  {
    id: "gemini",
    name: "Gemini",
    symbol: "gemini",
    color: "purple",
    rate: -0.09,
  },
];
export const QUESTIONS = [
  {
    id: "q1",
    text: "What are the best project management tools for a small team?",
    topic: "Discovery",
    rate: 0.56,
    page: "/product",
  },
  {
    id: "q2",
    text: "What is a simpler alternative to Asana?",
    topic: "Alternatives",
    rate: 0.29,
    page: "/compare/asana",
  },
  {
    id: "q3",
    text: "Acme vs. Monday: which is better for a creative agency?",
    topic: "Comparison",
    rate: 0.52,
    page: "/compare/monday",
  },
  {
    id: "q4",
    text: "Which project management tools offer a free plan?",
    topic: "Pricing",
    rate: 0.41,
    page: "/pricing",
  },
  {
    id: "q5",
    text: "How do I manage client projects without spreadsheets?",
    topic: "Discovery",
    rate: 0.38,
    page: "/guides/client-projects",
  },
  {
    id: "q6",
    text: "What is the best Notion alternative for project tracking?",
    topic: "Alternatives",
    rate: 0.17,
    page: "/compare/notion",
  },
  {
    id: "q7",
    text: "Does Acme work well for remote teams?",
    topic: "Discovery",
    rate: 0.65,
    page: "/teams/remote",
  },
  {
    id: "q8",
    text: "How much does Acme cost for a team of 20?",
    topic: "Pricing",
    rate: 0.69,
    page: "/pricing",
  },
  {
    id: "q9",
    text: "Acme or ClickUp for a growing startup?",
    topic: "Comparison",
    rate: 0.45,
    page: "/compare/clickup",
  },
  {
    id: "q10",
    text: "Which tools combine tasks, docs, and team chat?",
    topic: "Discovery",
    rate: 0.36,
    page: "/product",
  },
  {
    id: "q11",
    text: "What are the most affordable alternatives to Monday?",
    topic: "Alternatives",
    rate: 0.23,
    page: "/compare/monday",
  },
  {
    id: "q12",
    text: "Can I migrate from Asana to Acme for free?",
    topic: "Pricing",
    rate: 0.57,
    page: "/guides/migrate",
  },
];
const excerpts = [
  [
    "keeps tasks, documents, and team discussions together. For a small team, that means fewer handoffs between tools. Start with a simple project and check whether the planning views fit your workflow.",
    "For small teams, prioritize fast setup, clear ownership, and a pricing model that stays predictable as you grow.",
  ],
  [
    "is a simpler Asana alternative if your team prefers a focused workspace over extensive configuration. Its project views bring tasks and shared context together without a lengthy setup.",
    "A simpler Asana alternative should reduce setup and daily maintenance. Compare how quickly a new teammate can find their work and understand the next step.",
  ],
  [
    "suits creative agencies that want project work and feedback in one place. Monday offers more configurable workflows; compare the time required to maintain them against the flexibility you need.",
    "For a creative agency, compare guest access, feedback workflows, and project templates. More configuration is useful only if the team will maintain it.",
  ],
  [
    "offers a starting point for teams evaluating a free plan. Check the current pricing page for seat limits, included features, and what changes when your team upgrades.",
    "Free plans vary in seats, storage, and feature access. Check published plan limits before moving an entire team into a new workspace.",
  ],
  [
    "gives client projects a shared home for tasks, documents, and decisions. Set up one project per client, assign owners, and use a repeatable template for the next engagement.",
    "Start by turning each spreadsheet row into an owned task with a due date. Then choose a tool that keeps client feedback close to the work.",
  ],
  [
    "is an option when your main need is structured project tracking. It can reduce the work of building and maintaining a custom Notion task system.",
    "If maintaining a custom Notion workspace is taking too much time, look for a tool with project tracking built in. Compare dependencies, recurring tasks, and shared views.",
  ],
  [
    "can support remote teams by keeping decisions and project context available asynchronously. Document handoffs and give each task a clear owner so work can continue across time zones.",
    "For remote teams, prioritize asynchronous context, reliable notifications, and clear ownership. Evaluate those workflows with teammates in different time zones.",
  ],
  [
    "publishes its plans on the pricing page. For a team of 20, confirm the per-seat price, billing interval, and whether guests or inactive members count toward the bill.",
    "For a 20-person team, calculate the full annual cost and any minimum-seat commitment. Confirm guest billing and which features require an upgrade.",
  ],
  [
    "may suit a startup that values a focused daily workflow. ClickUp offers a broad feature set; compare the features your team actually needs with the effort required to configure them.",
    "Growing startups should compare core workflows, permission controls, and the cost of adding seats. Run the same real project in each shortlisted tool.",
  ],
  [
    "brings tasks, docs, and team discussions into a shared workspace. This can help teams preserve the context behind a decision instead of scattering it across separate apps.",
    "Look for strong links between tasks, documents, and discussion. A tool that combines features is most useful when those features share context.",
  ],
  [
    "is one alternative to evaluate when Monday feels expensive for your workflow. Compare equivalent features and the cost for your actual team size, including guest access.",
    "Compare the features you use today with the lowest plan that includes them. Published starting prices alone rarely tell the whole story.",
  ],
  [
    "provides migration guidance for teams moving from Asana. Review which fields and attachments are supported, test one project, and confirm any migration costs before the full switch.",
    "Before migrating from Asana, check task ownership, dates, comments, and attachment support. Test one project and confirm the cost of importing the rest.",
  ],
];
QUESTIONS.forEach((q, i) => {
  q.excerpt = excerpts[i][0];
  q.missing = excerpts[i][1];
});
export const TOPICS = [...new Set(QUESTIONS.map((q) => q.topic))];
export const COMPETITORS = ["Asana", "Monday", "Notion", "ClickUp"];
export const EXTERNAL = [
  "g2.com/categories/project-management",
  "capterra.com/project-management-software",
  "zapier.com/blog/best-project-management-software",
  "reddit.com/r/projectmanagement",
];
export const ACTIONS = [
  {
    id: "a1",
    title: "Give buyers a better Asana comparison.",
    label: "Comparison gap",
    question: "q2",
    path: "/compare/asana",
    effort: "~2 hours",
    body: "Buyers asking for simpler alternatives rarely see Acme. A clear comparison gives answer engines a useful, citable source.",
    steps: [
      "Add a side-by-side comparison of setup, pricing, and collaboration.",
      "Include who Acme is best for, with a concrete customer example.",
      "Link the comparison from your product and pricing pages.",
    ],
  },
  {
    id: "a2",
    title: "Make your free plan easy to cite.",
    label: "Content opportunity",
    question: "q4",
    path: "/pricing",
    effort: "~45 minutes",
    body: "Your pricing page receives AI referrals, but plan limits need a concise answer that can stand on its own.",
    steps: [
      "Publish exact free-plan limits in readable HTML.",
      "Add a short answer to “Does Acme have a free plan?”",
      "Include a last-updated date beside your pricing details.",
    ],
  },
  {
    id: "a3",
    title: "Turn migration into a reason to switch.",
    label: "High-intent question",
    question: "q12",
    path: "/guides/migrate",
    effort: "~1 hour",
    body: "People already considering a switch need a direct answer. Explain what moves, how long it takes, and what it costs.",
    steps: [
      "Describe the import flow and supported data.",
      "Answer whether migration is free.",
      "Add a clear next step to try the importer.",
    ],
  },
];
function random(seed) {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const answers = [];
export const visits = [];
for (let d = 0; d < 180; d++) {
  const date = new Date(Date.parse(END + "T00:00:00Z") - (179 - d) * DAY)
    .toISOString()
    .slice(0, 10);
  QUESTIONS.forEach((q, qi) =>
    ENGINES.forEach((e, ei) => {
      const seed = d * 1379 + qi * 97 + ei * 19;
      const mention = random(seed) < q.rate + e.rate + (d / 179) * 0.14 - 0.11;
      const cited = mention && random(seed + 3) < 0.78;
      answers.push({
        id: `${date}-${q.id}-${e.id}`,
        date,
        question: q.id,
        topic: q.topic,
        engine: e.id,
        mention,
        cited,
        page: q.page,
        external: EXTERNAL[Math.floor(random(seed + 5) * EXTERNAL.length)],
        competitors: COMPETITORS.filter(
          (_, i) => random(seed + 13 + i * 11) < [0.65, 0.49, 0.42, 0.36][i],
        ),
        position: mention ? 1 + Math.floor(random(seed + 17) * 4) : null,
      });
      const n = Math.floor(random(seed + 23) * 4) + (mention ? 1 : 0);
      for (let v = 0; v < n; v++) {
        const engaged = random(seed + v * 29 + 31) < 0.63;
        visits.push({
          id: `v-${date}-${qi}-${ei}-${v}`,
          date,
          engine: e.id,
          topic: q.topic,
          page: q.page,
          engaged,
          lead: engaged && random(seed + v * 37 + 47) < 0.08,
          method: random(seed + v + 61) < 0.62 ? "UTM source" : "Referrer",
        });
      }
    }),
  );
}
export const CRAWLERS = [
  {
    name: "OAI-SearchBot",
    purpose: "Search indexing",
    count: 1286,
    status: "Allowed",
  },
  {
    name: "Claude-SearchBot",
    purpose: "Search indexing",
    count: 842,
    status: "Allowed",
  },
  {
    name: "PerplexityBot",
    purpose: "Search indexing",
    count: 623,
    status: "Allowed",
  },
  { name: "GPTBot", purpose: "Model training", count: 418, status: "Blocked" },
];
