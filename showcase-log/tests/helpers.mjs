// helpers.mjs — shared scratch-directory utility for the smoke tests. Not
// part of the skill's runtime: lives outside scripts/, so Step 7's
// `scripts/*.mjs → _scripts/*.mjs` copy never ships this (or any test) into
// a consumer project.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function makeScratchDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `showcase-log-test-${prefix}-`));
}

export function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Build a fixture session-log.md with n simple entries, one per (day mod 28)
 * so dates stay within June 2026 — matches the shape archive-session-log.mjs
 * and generate-recap.mjs both expect. */
export function fixtureLog(n, { keyDecisions = false } = {}) {
  const lines = ['# Project Log', '', '---', '', '## Interaction Log', ''];
  for (let i = 1; i <= n; i++) {
    const day = (i % 28) + 1;
    lines.push(`### 2026-06-${String(day).padStart(2, '0')} 09:00–09:30 — Entry ${i}`);
    lines.push('');
    lines.push('**Prompt:**');
    lines.push(`> prompt number ${i}`);
    lines.push('');
    if (keyDecisions) {
      lines.push('**Key Decisions:**');
      lines.push(`- decision for entry ${i}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

/** Count real v2-heading entries across one or more markdown files' text. */
export function countHeadings(...texts) {
  let total = 0;
  for (const t of texts) total += (t.match(/^### \d{4}-\d{2}-\d{2}/gm) || []).length;
  return total;
}

/** generate-recap.mjs names its output after today's date, so tests can't
 * hardcode the filename — find the one dated recap file a fresh scratch dir
 * should contain after a single run. */
export function readRecapHtml(root) {
  const dir = path.join(root, 'session-log');
  const file = fs.readdirSync(dir).find((f) => /^\d{4}-\d{2}-\d{2}-Recap\.html$/.test(f));
  assert(file, `expected a YYYY-MM-DD-Recap.html file in ${dir}`);
  return fs.readFileSync(path.join(dir, file), 'utf8');
}

/** Same as readRecapHtml, but for the --share output (YYYY-MM-DD-Recap-Shared.html). */
export function readSharedRecapHtml(root) {
  const dir = path.join(root, 'session-log');
  const file = fs.readdirSync(dir).find((f) => /^\d{4}-\d{2}-\d{2}-Recap-Shared\.html$/.test(f));
  assert(file, `expected a YYYY-MM-DD-Recap-Shared.html file in ${dir}`);
  return fs.readFileSync(path.join(dir, file), 'utf8');
}
