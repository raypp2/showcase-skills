#!/usr/bin/env node
// generate-recap.mjs — renders session-log/recap.html: a single-page
// overview combining cost (the same two tables cost-report.mjs prints),
// milestones (condensed — see decision-digest.mjs in chat for everything on
// the decisions side), and key decisions (capped). Deterministic assembly of
// what the other scripts already compute; no narrative writing, no era
// inference.
//
// USAGE:
//   node _scripts/generate-recap.mjs           # write session-log/recap.html
//   node _scripts/generate-recap.mjs --root <dir>
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolvePaths } from './lib/paths.mjs';
import { loadEntries, loadMarkers, entryLabel } from './lib/log.mjs';
import { loadUsageRows, localDay, fmt, money, windowTotal } from './lib/usage.mjs';

const DECISIONS_SHOWN = 15;
const MILESTONES_SHOWN = 10;

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const P = resolvePaths(opt('--root') || path.resolve(SCRIPT_DIR, '..'));
const projectName = path.basename(P.ROOT);

const entries = loadEntries(P);
const { milestones } = loadMarkers(P);
const usageRows = loadUsageRows(P);

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- cost: by model ---
function costByModelTable() {
  const byModel = new Map();
  let total = { msgs: 0, cost: 0 };
  for (const r of usageRows) {
    if (!byModel.has(r.model)) byModel.set(r.model, { msgs: 0, cost: 0 });
    const a = byModel.get(r.model);
    a.msgs++; a.cost += r.cost_usd;
    total.msgs++; total.cost += r.cost_usd;
  }
  if (!byModel.size) return '<p class="empty-note">No usage data yet.</p>';
  const rows = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost)
    .map(([m, a]) => `<tr><td>${escapeHtml(m)}</td><td class="num">${money(a.cost)}</td></tr>`)
    .join('\n');
  return `<table>
    <thead><tr><th>Model</th><th class="num">Cost</th></tr></thead>
    <tbody>${rows}<tr class="total"><td>Total</td><td class="num">${money(total.cost)}</td></tr></tbody>
  </table>`;
}

// --- cost: by time window ---
function costByWindowTable() {
  if (!usageRows.length) return '';
  const latestTs = usageRows.reduce((a, r) => (r.ts && r.ts > a ? r.ts : a), '');
  const latestSession = usageRows.slice().reverse().find((r) => r.ts === latestTs)?.session;
  const now = latestTs ? new Date(latestTs) : new Date();
  const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString();
  const windows = [
    ['This session', (r) => r.session === latestSession],
    ['Last 7 days', (r) => r.ts >= daysAgo(7)],
    ['Last 30 days', (r) => r.ts >= daysAgo(30)],
    ['All time', () => true],
  ];
  const rows = windows.map(([label, pred]) => {
    const w = windowTotal(usageRows, pred);
    return `<tr><td>${label}</td><td class="num">${money(w.cost)}</td></tr>`;
  }).join('\n');
  return `<table>
    <thead><tr><th>Window</th><th class="num">Cost</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// --- helpers for daily grouping ---

/** Format "YYYY-MM-DD" as "Jun 10" */
function shortDate(ymd) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [, m, d] = ymd.split('-');
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

/** Format "YYYY-MM-DD" as lowercase id like "jun10" */
function dayId(ymd) {
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const [, m, d] = ymd.split('-');
  return `${months[parseInt(m, 10) - 1]}${parseInt(d, 10)}`;
}

/** Format "YYYY-MM-DD" as full date like "June 10, 2025" */
function fullDate(ymd) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [y, m, d] = ymd.split('-');
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

/** Parse "HH:MM" to fractional hours since midnight */
function timeToHours(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}

/** Build per-day data structure used by dailyBars, dayPanels, and JS output */
function buildDailyData() {
  // Group entries by date
  const byDay = new Map();
  for (const e of entries) {
    const d = e.date || 'undated';
    if (d === 'undated') continue;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(e);
  }

  // Group usage by date
  const usageByDay = new Map();
  for (const r of usageRows) {
    const d = localDay(r.ts);
    if (d === 'unknown') continue;
    usageByDay.set(d, (usageByDay.get(d) || 0) + r.cost_usd);
  }

  // Build sorted array of days
  const days = [...byDay.keys()].sort();
  const result = [];
  for (const d of days) {
    const dayEntries = byDay.get(d);
    const count = dayEntries.length;
    const cost = usageByDay.has(d) ? usageByDay.get(d) : count * 8; // estimate $8/entry if no usage data

    // Compute hours from start/end times
    let hours = 0;
    for (const e of dayEntries) {
      const s = timeToHours(e.start);
      const en = timeToHours(e.end);
      if (s !== null && en !== null && en > s) {
        hours += en - s;
      }
    }

    result.push({ date: d, entries: dayEntries, count, cost, hours });
  }
  return result;
}

// --- daily cost bars (replaces weeklyBars) ---
function dailyBars() {
  const daily = buildDailyData();
  if (!daily.length) return '<p class="empty-note">No dated entries yet.</p>';

  const maxCost = Math.max(...daily.map((d) => d.cost));

  const bars = daily.map((d, idx) => {
    const pct = maxCost > 0 ? Math.round((d.cost / maxCost) * 100) : 0;
    const opacity = (0.15 + (pct / 100) * 0.85).toFixed(2);
    const label = shortDate(d.date);
    const id = dayId(d.date);
    const dom = parseInt(d.date.split('-')[2], 10);
    const hoursStr = d.hours > 0 ? `${d.hours.toFixed(1)}h` : '—';
    const costStr = money(d.cost);

    return `<a class="cost-bar-wrap" href="#panel-${id}" data-day="${label}" data-idx="${idx}" style="text-decoration:none;color:inherit;">
  <div class="bar-tooltip">
    <div class="tt-date">${label}</div>
    <div class="tt-row"><span class="tt-label">Entries</span><span>${d.count}</span></div>
    <div class="tt-row"><span class="tt-label">Time</span><span>${hoursStr}</span></div>
    <div class="tt-row"><span class="tt-label">Est. cost</span><span>${costStr}</span></div>
  </div>
  <div class="cost-bar" style="height:${pct}%;background:rgba(181,86,47,${opacity})"></div>
  <div class="cost-bar-label">${dom}</div>
</a>`;
  }).join('\n');

  // Add date axis
  const axisLabels = [];
  const step = Math.max(1, Math.ceil(daily.length / 7));
  for (let i = 0; i < daily.length; i += step) {
    axisLabels.push(shortDate(daily[i].date));
  }
  const axis = `<div class="date-axis" style="margin-top:8px;"><span>${axisLabels.join('</span><span>')}</span></div>`;
  return bars + '\n' + axis;
}

// --- no-JS day panels ---
function dayPanels() {
  const daily = buildDailyData();
  if (!daily.length) return '';

  return daily.map((d) => {
    const id = dayId(d.date);
    const full = fullDate(d.date);
    const costStr = money(d.cost);

    const entryItems = d.entries.map((e) => {
      const label = entryLabel(e.heading);
      const timeStr = e.start && e.end ? `${e.start}–${e.end}` : '';
      return `<div class="entry-item">
        <div class="entry-dot"></div>
        <div class="entry-desc">${escapeHtml(label)}</div>
        <div class="entry-meta">${escapeHtml(timeStr)}</div>
      </div>`;
    }).join('\n');

    return `<div id="panel-${id}" class="day-panel-target">
  <a href="#page" class="panel-bg" aria-label="Close"></a>
  <div class="panel-fg">
    <div class="panel-header">
      <a href="#page" class="panel-close-link" aria-label="Close">&times;</a>
      <div class="panel-date">${full}</div>
      <div class="panel-stats">${d.count} entries · <strong>~${costStr}</strong> estimated cost</div>
    </div>
    <div class="panel-body">
      ${entryItems}
    </div>
  </div>
</div>`;
  }).join('\n');
}

// --- JS data for interactive enhancement ---
function dailyDataJs() {
  const daily = buildDailyData();
  const items = daily.map((d) => {
    const label = shortDate(d.date);
    return `{key:"${label}",n:${d.count},c:${Math.round(d.cost)},h:${Math.round(d.hours * 10) / 10}}`;
  }).join(',\n  ');
  const maxCost = daily.length ? Math.round(Math.max(...daily.map((d) => d.cost))) : 0;
  return `var dailyData = [\n  ${items}\n];\nvar maxCost = ${maxCost};`;
}

function entriesJs() {
  const daily = buildDailyData();
  const dayStrings = daily.map((d) => {
    const label = shortDate(d.date);
    const items = d.entries.map((e) => {
      const desc = entryLabel(e.heading).replace(/"/g, '\\"');
      return `["${desc}",0,""]`;
    }).join(',');
    return `"${label}": [${items}]`;
  }).join(',\n');
  return `var E = {\n${dayStrings}\n};`;
}

function startDateJs() {
  const dates = entries.map((e) => e.date).filter(Boolean).sort();
  if (!dates.length) return 'var startDate = new Date();';
  const [y, m, d] = dates[0].split('-').map(Number);
  return `var startDate = new Date(${y}, ${m - 1}, ${d});`;
}

function totalDaysJs() {
  const dates = entries.map((e) => e.date).filter(Boolean).sort();
  if (dates.length < 2) return `var totalDays = ${dates.length};`;
  const first = new Date(dates[0]);
  const last = new Date(dates[dates.length - 1]);
  const diff = Math.round((last - first) / 86400000) + 1;
  return `var totalDays = ${diff};`;
}

// --- hours estimate ---
function hoursEstimate() {
  let totalHours = 0;
  for (const e of entries) {
    const s = timeToHours(e.start);
    const en = timeToHours(e.end);
    if (s !== null && en !== null && en > s) {
      totalHours += en - s;
    }
  }
  if (totalHours === 0) return '—';
  return `${totalHours.toFixed(1)}h`;
}

// --- milestones, condensed ---
function milestonesSection() {
  if (!milestones.length) {
    return '<p class="empty-note">No milestones marked yet. Say "mark this as a milestone" when something notable ships.</p>';
  }
  const shown = milestones.slice(-MILESTONES_SHOWN).reverse();
  const items = shown.map((m) =>
    `<li><span class="m-date">${escapeHtml(m.date)}</span><span>${escapeHtml(m.text)}</span></li>`).join('\n');
  const note = milestones.length > MILESTONES_SHOWN
    ? `<p class="note">Showing the ${MILESTONES_SHOWN} most recent of ${milestones.length} — see the full timeline for all of them.</p>` : '';
  return `<ul class="milestone-list">${items}</ul>${note}`;
}

// --- decisions, capped ---
function decisionsSection() {
  const withDecisions = entries.filter((e) => e.keyDecisions.length > 0);
  if (!withDecisions.length) return '<p class="empty-note">No Key Decisions logged yet.</p>';
  const shown = withDecisions.slice(-DECISIONS_SHOWN).reverse();
  const cards = shown.map((e) => {
    const items = e.keyDecisions.map((d) => `<li>${escapeHtml(d)}</li>`).join('');
    return `<div class="decision">
      <div class="d-date">${escapeHtml(e.date || 'undated')}</div>
      <div class="d-label">${escapeHtml(entryLabel(e.heading))}</div>
      <ul>${items}</ul>
    </div>`;
  }).join('\n');
  const note = withDecisions.length > DECISIONS_SHOWN
    ? `<p class="note">Showing the ${DECISIONS_SHOWN} most recent of ${withDecisions.length} — ask for the full decision digest to see everything.</p>` : '';
  return `${cards}${note}`;
}

// --- AI section placeholders ---
function aiPlaceholder() {
  return `<div class="viz-card narrative">
  <p class="empty-note">This section is generated by Claude when you ask for a full recap. Run the script first, then ask Claude to fill in the analysis sections.</p>
</div>`;
}

function workstreamsPlaceholder() { return aiPlaceholder(); }
function timelinePlaceholder() { return aiPlaceholder(); }
function patternsPlaceholder() { return aiPlaceholder(); }
function recommendationsPlaceholder() { return aiPlaceholder(); }

const dates = entries.map((e) => e.date).filter(Boolean);
const dateRange = dates.length ? `${dates.reduce((a, b) => (a < b ? a : b))} – ${dates.reduce((a, b) => (a > b ? a : b))}` : 'no dated entries yet';
const dayCount = new Set(dates).size;
const totalCost = usageRows.reduce((s, r) => s + r.cost_usd, 0);

const templatePath = path.join(SCRIPT_DIR, '..', 'assets', 'recap-template.html');
let html = fs.readFileSync(templatePath, 'utf8');
html = html
  .replaceAll('{{PROJECT_NAME}}', escapeHtml(projectName))
  .replaceAll('{{DATE_RANGE}}', escapeHtml(dateRange))
  .replaceAll('{{GENERATED_DATE}}', new Date().toISOString().slice(0, 10))
  .replace('{{ENTRY_COUNT}}', fmt(entries.length))
  .replace('{{TOTAL_COST}}', usageRows.length ? money(totalCost) : '—')
  .replace('{{DAY_COUNT}}', fmt(dayCount))
  .replace('{{COST_BY_MODEL_TABLE}}', costByModelTable())
  .replace('{{COST_BY_WINDOW_TABLE}}', costByWindowTable())
  .replace('{{DAILY_BARS}}', dailyBars())
  .replace('{{DAY_PANELS}}', dayPanels())
  .replace('{{DAILY_DATA_JS}}', dailyDataJs())
  .replace('{{ENTRIES_JS}}', entriesJs())
  .replace('{{START_DATE_JS}}', startDateJs())
  .replace('{{TOTAL_DAYS_JS}}', totalDaysJs())
  .replace('{{HOURS_ESTIMATE}}', hoursEstimate())
  .replace('{{MILESTONES_SECTION}}', milestonesSection())
  .replace('{{DECISIONS_SECTION}}', decisionsSection())
  .replace('{{PROJECT_DESC}}', '')
  .replace('{{WORKSTREAMS_SECTION}}', workstreamsPlaceholder())
  .replace('{{TIMELINE_SECTION}}', timelinePlaceholder())
  .replace('{{PATTERNS_SECTION}}', patternsPlaceholder())
  .replace('{{RECOMMENDATIONS_SECTION}}', recommendationsPlaceholder());

fs.mkdirSync(P.LOG_DIR, { recursive: true });
fs.writeFileSync(P.RECAP_FILE, html);
console.log(`Wrote ${P.RECAP_FILE} (${entries.length} entries, ${milestones.length} milestones, ${entries.filter((e) => e.keyDecisions.length).length} entries with decisions)`);
