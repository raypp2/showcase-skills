#!/usr/bin/env node
// decision-digest.mjs — every **Key Decisions:** bullet across the project,
// pulled into one scannable, dated list. Chat-only output (no HTML) — reads
// straight from session-log/, no persisted file, cheap enough to run fresh
// each time it's asked for.
//
// Deliberately mechanical: the label on each entry is that entry's own
// heading description, taken verbatim — never an invented summary. This is
// meant to read like a running engineering-decisions log, not curated prose.
//
// USAGE:
//   node _scripts/decision-digest.mjs              # everything, oldest first
//   node _scripts/decision-digest.mjs --days 7      # only the last N days
//   node _scripts/decision-digest.mjs --root <dir>
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolvePaths } from './lib/paths.mjs';
import { loadEntries, entryLabel } from './lib/log.mjs';

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const P = resolvePaths(opt('--root') || path.resolve(SCRIPT_DIR, '..'));
const days = opt('--days') ? Number(opt('--days')) : null;

let entries = loadEntries(P).filter((e) => e.keyDecisions.length > 0);

if (days) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  entries = entries.filter((e) => !e.date || e.date >= cutoff);
}

if (!entries.length) {
  console.log(days ? `No Key Decisions logged in the last ${days} days.` : 'No Key Decisions logged yet.');
  process.exit(0);
}

console.log(`${entries.length} decision${entries.length === 1 ? '' : 's'}${days ? ` in the last ${days} days` : ''}:\n`);
for (const e of entries) {
  console.log(`${e.date || '(undated)'}  ${entryLabel(e.heading)}`);
  for (const d of e.keyDecisions) console.log(`  - ${d}`);
  console.log('');
}
