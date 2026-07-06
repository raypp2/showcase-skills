// enrich-dates.test.mjs — smoke tests for enrich-log-dates.mjs: the script
// that stamps real dates onto pre-v2 numbered entries (`### #N — ...`) that
// migrated into session-log/session-log.md with content but no date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeScratchDir, cleanup } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'enrich-log-dates.mjs');

function writeTranscript(root, records) {
  const dir = path.join(root, 'transcripts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'session.jsonl'), records.map((r) => JSON.stringify(r)).join('\n'));
  return dir;
}

function userTurn(ts, text) {
  return { type: 'user', timestamp: ts, message: { role: 'user', content: text } };
}

function writeLog(root, text) {
  fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
  fs.writeFileSync(path.join(root, 'session-log', 'session-log.md'), text);
}

function readLog(root) {
  return fs.readFileSync(path.join(root, 'session-log', 'session-log.md'), 'utf8');
}

test('matches undated entries to transcript turns in chronological order', () => {
  const root = makeScratchDir('enrich-basic');
  try {
    const transcripts = writeTranscript(root, [
      userTurn('2026-07-01T10:00:00.000Z', 'please add a dark mode toggle to the settings page'),
      userTurn('2026-07-02T14:00:00.000Z', 'now add a light mode toggle too for symmetry'),
    ]);
    writeLog(root, [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### #1 — [09:00–09:15] Dark mode toggle', '', '**Prompt:**',
      '> please add a dark mode toggle to the settings page', '',
      '### #2 — [09:20–09:30] Light mode toggle', '', '**Prompt:**',
      '> now add a light mode toggle too for symmetry', '',
    ].join('\n'));
    const out = execFileSync(process.execPath, [SCRIPT, '--root', root, '--transcripts', transcripts]).toString();
    assert.ok(out.includes('2 of 2 undated entries got a date'));
    const log = readLog(root);
    assert.ok(log.includes('### #1 — 2026-07-01 [09:00–09:15] Dark mode toggle'));
    assert.ok(log.includes('### #2 — 2026-07-02 [09:20–09:30] Light mode toggle'));
  } finally {
    cleanup(root);
  }
});

test('--report prints counts and writes nothing', () => {
  const root = makeScratchDir('enrich-report');
  try {
    const transcripts = writeTranscript(root, [
      userTurn('2026-07-01T10:00:00.000Z', 'please add a dark mode toggle to the settings page'),
    ]);
    writeLog(root, [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### #1 — [09:00–09:15] Dark mode toggle', '', '**Prompt:**',
      '> please add a dark mode toggle to the settings page', '',
    ].join('\n'));
    const before = readLog(root);
    const out = execFileSync(process.execPath, [SCRIPT, '--root', root, '--transcripts', transcripts, '--report']).toString();
    assert.ok(out.includes('1 of 1 entries have no date'));
    assert.equal(readLog(root), before, 'report mode must not modify the log');
  } finally {
    cleanup(root);
  }
});

test('an entry with no Prompt field is interpolated from its dated neighbors', () => {
  const root = makeScratchDir('enrich-interpolate');
  try {
    const transcripts = writeTranscript(root, [
      userTurn('2026-07-01T10:00:00.000Z', 'please add a dark mode toggle to the settings page'),
      userTurn('2026-07-05T10:00:00.000Z', 'ship the light mode toggle now that dark mode works'),
    ]);
    writeLog(root, [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### #1 — [09:00–09:15] Dark mode toggle', '', '**Prompt:**',
      '> please add a dark mode toggle to the settings page', '',
      '### #2 — [09:20–09:30] Undocumented follow-up', '', '**Outcome:** tweaked spacing.', '',
      '### #3 — [09:40–09:50] Light mode toggle', '', '**Prompt:**',
      '> ship the light mode toggle now that dark mode works', '',
    ].join('\n'));
    const out = execFileSync(process.execPath, [SCRIPT, '--root', root, '--transcripts', transcripts]).toString();
    assert.ok(out.includes('interpolated from neighbors'));
    const log = readLog(root);
    assert.ok(log.includes('### #1 — 2026-07-01 [09:00–09:15] Dark mode toggle'));
    assert.ok(log.includes('### #2 — 2026-07-01 [09:20–09:30] Undocumented follow-up'), 'no-prompt entry should inherit its left neighbor\'s date');
    assert.ok(log.includes('### #3 — 2026-07-05 [09:40–09:50] Light mode toggle'));
  } finally {
    cleanup(root);
  }
});

test('with no recoverable transcript history, entries are left unchanged', () => {
  const root = makeScratchDir('enrich-no-history');
  try {
    writeLog(root, [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### #1 — [09:00–09:15] Dark mode toggle', '', '**Prompt:**',
      '> please add a dark mode toggle to the settings page', '',
    ].join('\n'));
    const before = readLog(root);
    const out = execFileSync(process.execPath, [SCRIPT, '--root', root, '--transcripts', path.join(root, 'nonexistent')]).toString();
    assert.ok(out.includes('no transcript history is available'));
    assert.equal(readLog(root), before, 'no-history run must not modify the log');
  } finally {
    cleanup(root);
  }
});

test('already-dated v2 entries are left untouched and are not re-matched', () => {
  const root = makeScratchDir('enrich-mixed');
  try {
    const transcripts = writeTranscript(root, [
      userTurn('2026-07-01T10:00:00.000Z', 'please add a dark mode toggle to the settings page'),
    ]);
    writeLog(root, [
      '# Project Log', '', '---', '', '## Interaction Log', '',
      '### 2026-06-15 09:00–09:15 — Already dated entry', '', '**Prompt:**',
      '> please add a dark mode toggle to the settings page', '',
      '### #1 — [09:20–09:30] Undated entry', '', '**Prompt:**',
      '> a completely unrelated later request about billing', '',
    ].join('\n'));
    execFileSync(process.execPath, [SCRIPT, '--root', root, '--transcripts', transcripts]);
    const log = readLog(root);
    assert.ok(log.includes('### 2026-06-15 09:00–09:15 — Already dated entry'), 'v2 heading must be untouched');
  } finally {
    cleanup(root);
  }
});
