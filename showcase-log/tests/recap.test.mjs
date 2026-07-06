// recap.test.mjs — smoke tests for generate-recap.mjs, including regression
// coverage for two bugs fixed in this file: same-month-day entries in
// different years colliding on one HTML id/key, and estimated-vs-measured
// cost being labeled identically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeScratchDir, cleanup, fixtureLog, readRecapHtml, readSharedRecapHtml } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'generate-recap.mjs');

function writeLog(root, text) {
  fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
  fs.writeFileSync(path.join(root, 'session-log', 'session-log.md'), text);
}

test('generate-recap produces well-formed output with no leftover template tokens', () => {
  const root = makeScratchDir('recap-basic');
  try {
    writeLog(root, fixtureLog(3, { keyDecisions: true }));
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    const html = readRecapHtml(root);
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(html), 'no unreplaced {{PLACEHOLDER}} tokens should remain');
    assert.equal((html.match(/<html/g) || []).length, 1);
    assert.equal((html.match(/<\/html>/g) || []).length, 1);
    // Key Decisions has no deterministic section anymore (removed in favor of the
    // AI-authored Milestones & capabilities timeline, plus conversational lookup
    // straight from the log) — this fixture just confirms parsing entries with
    // that field doesn't break generation.
  } finally {
    cleanup(root);
  }
});

test('same month/day in two different years gets distinct ids and data keys', () => {
  const root = makeScratchDir('recap-year-collision');
  try {
    const text = [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### 2025-06-10 09:00–09:30 — Old year entry', '', '**Prompt:**', '> entry from 2025', '',
      '### 2026-06-10 09:00–09:30 — New year entry', '', '**Prompt:**', '> entry from 2026', '',
    ].join('\n');
    writeLog(root, text);
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    const html = readRecapHtml(root);
    assert.ok(html.includes('id="panel-2025-06-10"'));
    assert.ok(html.includes('id="panel-2026-06-10"'));
    assert.ok(html.includes('"2025-06-10": ["Old year entry"]'));
    assert.ok(html.includes('"2026-06-10": ["New year entry"]'));
  } finally {
    cleanup(root);
  }
});

test('days with no usage data are marked estimated, days with real usage are not', () => {
  const root = makeScratchDir('recap-estimated');
  try {
    const text = [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### 2026-07-01 09:00–09:30 — Measured day', '', '**Prompt:**', '> has usage data', '',
      '### 2026-07-02 09:00–09:30 — Estimated day', '', '**Prompt:**', '> no usage data', '',
    ].join('\n');
    writeLog(root, text);
    fs.mkdirSync(path.join(root, 'session-log', 'usage'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'session-log', 'usage', 'usage.jsonl'),
      [
        JSON.stringify({ _comment: 'test' }),
        JSON.stringify({ id: 'm1', ts: '2026-07-01T10:00:00.000Z', session: 's1', model: 'claude-sonnet-5', input: 1, output: 1, cache_write: 0, cache_read: 0, cost_usd: 5.25 }),
      ].join('\n'),
    );
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    const html = readRecapHtml(root);
    assert.ok(html.includes('{key:"2026-07-01",n:1,c:5,h:0.5,e:0}'), 'measured day should have e:0');
    // The estimated day inherits this project's measured rate ($5.25/entry from
    // the one measured day), not a flat $8 — 1 entry × 5.25 rounds to 5.
    assert.ok(html.includes('{key:"2026-07-02",n:1,c:5,h:0.5,e:1}'), 'estimated day should have e:1 and inherit the measured per-entry rate');
    assert.ok(html.includes("this project's measured average"), 'legend should state the estimate is derived from measured days');
  } finally {
    cleanup(root);
  }
});

test('with no measured usage at all, estimated days fall back to the $8/entry placeholder', () => {
  const root = makeScratchDir('recap-fallback');
  try {
    const text = [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### 2026-07-02 09:00–09:30 — Estimated day', '', '**Prompt:**', '> no usage data anywhere', '',
    ].join('\n');
    writeLog(root, text);
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    const html = readRecapHtml(root);
    assert.ok(html.includes('{key:"2026-07-02",n:1,c:8,h:0.5,e:1}'), 'with nothing to derive from, falls back to $8/entry');
    assert.ok(html.includes('$8/entry placeholder'), 'legend should call it a placeholder, not a measured average');
  } finally {
    cleanup(root);
  }
});

test('--share writes a separate -Shared.html file, leaving the private recap untouched', () => {
  const root = makeScratchDir('recap-share-separate-file');
  try {
    const text = [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### 2026-07-01 09:00–10:30 — First entry', '', '**Prompt:**', '> hello', '',
    ].join('\n');
    writeLog(root, text);
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    execFileSync(process.execPath, [SCRIPT, '--root', root, '--share']);
    const privateHtml = readRecapHtml(root);
    const sharedHtml = readSharedRecapHtml(root);
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(sharedHtml), 'no unreplaced {{PLACEHOLDER}} tokens should remain in the shared file');
    assert.ok(privateHtml.includes('Total spend'), 'private recap keeps the dollar stat');
    assert.ok(!sharedHtml.includes('Total spend'), 'shared recap drops the dollar stat entirely');
  } finally {
    cleanup(root);
  }
});

test('entries with no date at all get a diagnostic empty state, not a bare "nothing here" message', () => {
  const root = makeScratchDir('recap-undated-diagnostic');
  try {
    writeLog(root, [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### #1 — [09:00–09:15] Legacy entry', '', '**Prompt:**', '> a legacy prompt with no date', '',
    ].join('\n'));
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    const html = readRecapHtml(root);
    assert.ok(html.includes('backfill dates'), 'empty state should point at the fix, since entries exist but none are dated');
  } finally {
    cleanup(root);
  }
});

test('cost-by-window table labels the first row "Today", reflecting only the latest calendar day', () => {
  const root = makeScratchDir('recap-today-window');
  try {
    writeLog(root, [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### 2026-04-16 09:00–09:30 — Old entry', '', '**Prompt:**', '> old work', '',
      '### 2026-07-06 09:00–09:30 — Latest entry', '', '**Prompt:**', '> today\'s work', '',
    ].join('\n'));
    fs.mkdirSync(path.join(root, 'session-log', 'usage'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'session-log', 'usage', 'usage.jsonl'),
      [
        JSON.stringify({ id: 'm1', ts: '2026-04-16T10:00:00.000Z', session: 's1', model: 'claude-sonnet-5', input: 1, output: 1, cache_write: 0, cache_read: 0, cost_usd: 100 }),
        JSON.stringify({ id: 'm2', ts: '2026-07-06T09:00:00.000Z', session: 's1', model: 'claude-sonnet-5', input: 1, output: 1, cache_write: 0, cache_read: 0, cost_usd: 5 }),
      ].join('\n'),
    );
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    const html = readRecapHtml(root);
    assert.ok(html.includes('>Today<'), 'window table should label the first row "Today"');
    assert.ok(!html.includes('This session'));
  } finally {
    cleanup(root);
  }
});

test('--share replaces dollar figures with time/percentage and embeds no cost data at all', () => {
  const root = makeScratchDir('recap-share-no-cost-data');
  try {
    const text = [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### 2026-06-20 09:00–10:30 — Day one', '', '**Prompt:**', '> hello', '',
      '### 2026-06-21 09:00–09:20 — Day two', '', '**Prompt:**', '> hi', '',
    ].join('\n');
    writeLog(root, text);
    fs.mkdirSync(path.join(root, 'session-log', 'usage'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'session-log', 'usage', 'usage.jsonl'),
      [
        JSON.stringify({ id: 'm1', ts: '2026-06-20T14:00:00.000Z', session: 's1', model: 'claude-sonnet-5', input: 1, output: 1, cache_write: 0, cache_read: 0, cost_usd: 42.5 }),
        JSON.stringify({ id: 'm2', ts: '2026-06-21T09:15:00.000Z', session: 's2', model: 'claude-opus-4-8', input: 1, output: 1, cache_write: 0, cache_read: 0, cost_usd: 91.25 }),
      ].join('\n'),
    );
    execFileSync(process.execPath, [SCRIPT, '--root', root, '--share']);
    const html = readSharedRecapHtml(root);
    // The dailyData JS blob is what the interactive panel/hover reads from directly —
    // it must have no `c:` field at all, not just a hidden one, or view-source would
    // still leak the real dollar figures the whole point is to withhold.
    assert.ok(/\{key:"2026-06-20",n:1,h:1\.5,e:0\}/.test(html), 'dailyData entry should have no cost field, just key/n/h/e');
    assert.ok(!html.includes('c:42') && !html.includes('c:91'), 'no cost value should appear anywhere in the output');
    assert.ok(html.includes('1.5h'), 'daily bar should show hours');
    assert.ok(html.includes('cost-model-pct'), 'cost-by-model table should still render as percentages');
    assert.ok(!html.includes('<span class="cost-model-cost">'), 'cost-by-model table should not render a dollar span in share mode (the CSS rule for the class still exists in <style>, just unused)');
    assert.ok(html.includes('Time &amp; activity'), 'section heading should reflect the time-based framing');
  } finally {
    cleanup(root);
  }
});
