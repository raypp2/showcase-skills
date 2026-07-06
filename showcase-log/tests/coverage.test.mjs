// coverage.test.mjs — smoke tests for check-log-coverage.mjs: the audit that
// catches prompts sitting in transcripts but never logged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeScratchDir, cleanup } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'check-log-coverage.mjs');

function writeTranscript(root, records) {
  const dir = path.join(root, 'transcripts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'session.jsonl'), records.map((r) => JSON.stringify(r)).join('\n'));
  return dir;
}

function userTurn(ts, content) {
  return { type: 'user', timestamp: ts, message: { role: 'user', content } };
}

test('flags a real prompt that was never logged', () => {
  const root = makeScratchDir('coverage-gap');
  try {
    const transcripts = writeTranscript(root, [
      userTurn('2026-07-05T10:00:00.000Z', 'please add a dark mode toggle to the settings page'),
      userTurn('2026-07-05T10:30:00.000Z', 'this prompt was never logged anywhere at all'),
    ]);
    fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'session-log', 'session-log.md'),
      ['# Project Log', '', '---', '', '## Interaction Log', '',
        '### 2026-07-05 10:00–10:15 — Dark mode toggle', '', '**Prompt:**',
        '> please add a dark mode toggle to the settings page', ''].join('\n'),
    );
    execFileSync(process.execPath, [SCRIPT, '--root', root, '--transcripts', transcripts]);
    const report = fs.readFileSync(path.join(root, 'session-log', 'coverage.md'), 'utf8');
    assert.ok(report.includes('this prompt was never logged anywhere at all'));
    assert.ok(!report.includes('please add a dark mode toggle'), 'the covered turn should not appear as a gap');
  } finally {
    cleanup(root);
  }
});

test('short generic turns are neither flagged nor counted', () => {
  const root = makeScratchDir('coverage-short');
  try {
    const transcripts = writeTranscript(root, [userTurn('2026-07-05T10:00:00.000Z', 'ok')]);
    fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'session-log', 'session-log.md'),
      ['# Project Log', '', '---', '', '## Interaction Log', ''].join('\n'),
    );
    const out = execFileSync(process.execPath, [SCRIPT, '--root', root, '--transcripts', transcripts, '--report']).toString();
    assert.ok(out.includes('0 gap(s) of 0 checked'));
  } finally {
    cleanup(root);
  }
});

test('a clean project removes any stale coverage.md from a previous run', () => {
  const root = makeScratchDir('coverage-clean');
  try {
    const transcripts = writeTranscript(root, [userTurn('2026-07-05T10:00:00.000Z', 'a substantial logged prompt here')]);
    fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
    fs.writeFileSync(path.join(root, 'session-log', 'coverage.md'), 'stale report from a previous run');
    fs.writeFileSync(
      path.join(root, 'session-log', 'session-log.md'),
      ['# Project Log', '', '---', '', '## Interaction Log', '',
        '### 2026-07-05 10:00–10:15 — Entry', '', '**Prompt:**',
        '> a substantial logged prompt here', ''].join('\n'),
    );
    execFileSync(process.execPath, [SCRIPT, '--root', root, '--transcripts', transcripts]);
    assert.equal(fs.existsSync(path.join(root, 'session-log', 'coverage.md')), false);
  } finally {
    cleanup(root);
  }
});
