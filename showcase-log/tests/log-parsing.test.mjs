// log-parsing.test.mjs — smoke tests for lib/log.mjs's loadEntries(), in
// particular the Prompt-block extraction that feeds check-log-coverage.mjs.
// Covers both the standard `>` blockquote format and the older inline
// `**Prompt:** text` format found in some legacy/summarized entries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadEntries } from '../scripts/lib/log.mjs';
import { resolvePaths } from '../scripts/lib/paths.mjs';
import { makeScratchDir, cleanup } from './helpers.mjs';

test('extracts a standard blockquote prompt', () => {
  const root = makeScratchDir('logparse-blockquote');
  try {
    fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'session-log', 'session-log.md'),
      ['# Project Log', '', '---', '', '## Interaction Log', '',
        '### 2026-07-05 09:00–09:15 — Entry', '', '**Prompt:**', '> verbatim text here', '',
        '**Outcome:** did a thing.', ''].join('\n'),
    );
    const entries = loadEntries(resolvePaths(root));
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0].prompts, ['verbatim text here']);
  } finally {
    cleanup(root);
  }
});

test('extracts a multi-turn entry as separate blockquotes, in order', () => {
  const root = makeScratchDir('logparse-multiturn');
  try {
    fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'session-log', 'session-log.md'),
      ['# Project Log', '', '---', '', '## Interaction Log', '',
        '### 2026-07-05 09:00–09:15 — Entry', '', '**Prompt:**',
        '> first turn', '', '> second turn', '',
        '**Outcome:** done.', ''].join('\n'),
    );
    const entries = loadEntries(resolvePaths(root));
    assert.deepEqual(entries[0].prompts, ['first turn', 'second turn']);
  } finally {
    cleanup(root);
  }
});

test('extracts a legacy inline **Prompt:** (no blockquote) entry', () => {
  const root = makeScratchDir('logparse-inline');
  try {
    fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'session-log', 'session-log.md'),
      ['# Project Log', '', '---', '', '## Interaction Log', '',
        '### #47 — 2026-06-10 [18:52–19:15] Legacy entry', '',
        '**Prompt:** (continuation) inline legacy prompt text.', '',
        '**Approach:** did the thing.', ''].join('\n'),
    );
    const entries = loadEntries(resolvePaths(root));
    assert.deepEqual(entries[0].prompts, ['(continuation) inline legacy prompt text.']);
  } finally {
    cleanup(root);
  }
});
