import { animate, escape } from "./ui.js";
import { pct, fmt } from "./model.js";
export const LABELS = {
  visibility: "Mention rate",
  citations: "Website citations",
  referrals: "AI referrals",
  leads: "Leads from AI",
};
const format = (n, m) => (m === "visibility" ? pct(n) : fmt(n));
export function sparkline(svg, values) {
  const min = Math.min(...values),
    max = Math.max(...values);
  const d = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${(i / (values.length - 1)) * 108 + 1},${32 - ((v - min) / (max - min || 1)) * 27}`,
    )
    .join(" ");
  svg.innerHTML = `<path d="${d}"/>`;
}
function aggregate(series, key) {
  if (series.length <= 30) return series;
  const buckets = [];
  for (let i = 0; i < series.length; i += 3) {
    const rows = series.slice(i, i + 3);
    buckets.push({
      ...rows[0],
      dateEnd: rows.at(-1).date,
      [key]:
        key === "visibility"
          ? (rows.reduce((s, r) => s + r.mentions, 0) /
              rows.reduce((s, r) => s + r.samples, 0)) *
            100
          : rows.reduce((s, r) => s + r[key], 0),
      previous: {
        [key]:
          key === "visibility"
            ? (rows.reduce((s, r) => s + r.previous.mentions, 0) /
                rows.reduce((s, r) => s + r.previous.samples, 0)) *
              100
            : rows.reduce((s, r) => s + r.previous[key], 0),
      },
    });
  }
  return buckets;
}
export function renderChart(svg, series, key, compare, onDay) {
  const data = aggregate(series, key);
  const W = Math.max(280, svg.clientWidth),
    H = svg.clientHeight || 270,
    left = 40,
    right = 9,
    top = 15,
    bottom = 34,
    iw = W - left - right,
    ih = H - top - bottom;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const max =
    key === "visibility"
      ? 100
      : Math.max(
          5,
          Math.ceil(
            Math.max(
              ...data.flatMap((d) => [d[key], compare ? d.previous[key] : 0]),
            ) / 5,
          ) * 5,
        );
  const x = (i) => left + (i / (data.length - 1)) * iw,
    y = (n) => top + ih - (n / max) * ih;
  const points = curve(data.map((d, i) => [x(i), y(d[key])]));
  const prev = curve(data.map((d, i) => [x(i), y(d.previous[key])]));
  const labelIndices =
    W < 600
      ? [0, Math.round((data.length - 1) / 2), data.length - 1]
      : [
          0,
          Math.round((data.length - 1) / 4),
          Math.round((data.length - 1) / 2),
          Math.round(((data.length - 1) * 3) / 4),
          data.length - 1,
        ];
  const short = (d) =>
    new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  svg.innerHTML = `<defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--chart-fill)" stop-opacity=".16"/><stop offset="1" stop-color="var(--chart-fill)" stop-opacity="0"/></linearGradient></defs>${Array.from(
    { length: 5 },
    (_, i) => {
      const v = (i * max) / 4;
      return `<line class="chart-grid" x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-axis" x="${left - 12}" y="${y(v) + 4}" text-anchor="end">${key === "visibility" ? v + "%" : Number.isInteger(v) ? fmt(v) : v.toFixed(1)}</text>`;
    },
  ).join(
    "",
  )}<path class="chart-area-fill" d="${points}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z"/>${compare ? `<path class="chart-previous" d="${prev}"/>` : ""}<path class="chart-line" d="${points}"/>${labelIndices.map((i, j) => `<text class="chart-axis" x="${x(i)}" y="${H - 5}" text-anchor="${j === 0 ? "start" : j === labelIndices.length - 1 ? "end" : "middle"}">${short(data[i].date)}</text>`).join("")}<g id="chart-hover" hidden><line class="chart-crosshair" x1="0" x2="0" y1="${top}" y2="${y(0)}"/><circle class="chart-point" r="5" cx="0" cy="0"/></g>`;
  svg.setAttribute(
    "aria-label",
    `${LABELS[key]} ${data.length < series.length ? "in three-day groups" : "by day"}. Use arrow keys to explore and Enter for details.`,
  );
  const line = svg.querySelector(".chart-line"),
    len = line.getTotalLength();
  animate(
    line,
    [
      { strokeDasharray: `${len} ${len}`, strokeDashoffset: len },
      { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 },
    ],
    650,
  );
  const tip = document.getElementById("chart-tooltip"),
    hover = svg.querySelector("#chart-hover");
  let index = 0;
  function show(i) {
    index = Math.max(0, Math.min(data.length - 1, i));
    const d = data[index];
    hover.removeAttribute("hidden");
    const l = hover.querySelector("line"),
      c = hover.querySelector("circle");
    l.setAttribute("x1", x(index));
    l.setAttribute("x2", x(index));
    c.setAttribute("cx", x(index));
    c.setAttribute("cy", y(d[key]));
    tip.hidden = false;
    tip.innerHTML = `<strong>${short(d.date)}${d.dateEnd ? " – " + short(d.dateEnd) : ""}, 2026</strong><div class="tooltip-row"><span>${LABELS[key]}</span><b>${format(d[key], key)}</b></div>${compare ? `<div class="tooltip-row"><span>Previous period</span><b>${format(d.previous[key], key)}</b></div>` : ""}<small>Click to explore this ${d.dateEnd ? "period" : "day"}</small>`;
    const width = svg.getBoundingClientRect().width;
    tip.style.left = `${Math.max(0, Math.min((x(index) / W) * width + 14, width - tip.offsetWidth))}px`;
  }
  function hide() {
    hover.setAttribute("hidden", "");
    tip.hidden = true;
  }
  hide();
  svg.onpointermove = (e) => {
    const r = svg.getBoundingClientRect();
    show(
      Math.round(
        ((((e.clientX - r.left) / r.width) * W - left) / iw) *
          (data.length - 1),
      ),
    );
  };
  svg.onpointerleave = hide;
  svg.onfocus = () => show(index);
  svg.onblur = hide;
  svg.onclick = () => onDay(data[index].date, data[index].dateEnd);
  svg.onkeydown = (e) => {
    if (
      ["ArrowLeft", "ArrowRight", "Home", "End", "Enter", "Escape"].includes(
        e.key,
      )
    ) {
      e.preventDefault();
      if (e.key === "Enter") onDay(data[index].date, data[index].dateEnd);
      else if (e.key === "Escape") hide();
      else
        show(
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? data.length - 1
              : index + (e.key === "ArrowRight" ? 1 : -1),
        );
    }
  };
}

// Monotone cubic interpolation keeps each interval within its measured endpoints.
function curve(points) {
  if (points.length < 2) return "";
  const slopes = points
    .slice(1)
    .map((p, i) => (p[1] - points[i][1]) / (p[0] - points[i][0]));
  const tangents = points.map((_, i) =>
    i === 0
      ? slopes[0]
      : i === points.length - 1
        ? slopes.at(-1)
        : slopes[i - 1] * slopes[i] <= 0
          ? 0
          : 2 / (1 / slopes[i - 1] + 1 / slopes[i]),
  );
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x, y] = points[i],
      [nx, ny] = points[i + 1],
      dx = (nx - x) / 3;
    d += `C${x + dx},${y + tangents[i] * dx} ${nx - dx},${ny - tangents[i + 1] * dx} ${nx},${ny}`;
  }
  return d;
}
