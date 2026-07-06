// backfill.test.mjs — smoke tests for backfill-from-history.mjs, including
// regression coverage for the fix that stopped it from dropping prompts with
// an image attachment (array content with a text block, no tool_result).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeScratchDir, cleanup } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'backfill-from-history.mjs');

test('extracts plain prompts, keeps image-attached prompts, drops tool_result and junk turns', () => {
  const root = makeScratchDir('backfill-extract');
  try {
    const transcripts = path.join(root, 'transcripts');
    fs.mkdirSync(transcripts, { recursive: true });
    const records = [
      { type: 'user', timestamp: '2026-07-05T10:00:00.000Z', message: { role: 'user', content: 'plain string prompt' } },
      { type: 'user', timestamp: '2026-07-05T10:05:00.000Z', message: { role: 'user', content: [{ type: 'text', text: 'check this screenshot' }, { type: 'image', source: {} }] } },
      { type: 'user', timestamp: '2026-07-05T10:10:00.000Z', message: { role: 'user', content: [{ tool_use_id: 'x', type: 'tool_result', content: 'output' }] } },
      { type: 'user', timestamp: '2026-07-05T10:15:00.000Z', message: { role: 'user', content: '<command-name>/model</command-name>' } },
      { type: 'user', timestamp: '2026-07-05T10:20:00.000Z', message: { role: 'user', content: [{ type: 'image', source: {} }] } },
    ];
    fs.writeFileSync(path.join(transcripts, 'session.jsonl'), records.map((r) => JSON.stringify(r)).join('\n'));
    execFileSync(process.execPath, [SCRIPT, '--root', root, '--transcripts', transcripts]);
    const data = JSON.parse(fs.readFileSync(path.join(root, 'session-log', '.backfill-source.json'), 'utf8'));
    const texts = data.sessions[0].turns.map((t) => t.text);
    assert.deepEqual(texts, ['plain string prompt', 'check this screenshot']);
  } finally {
    cleanup(root);
  }
});

test('--report prints counts and writes nothing', () => {
  const root = makeScratchDir('backfill-report');
  try {
    const transcripts = path.join(root, 'transcripts');
    fs.mkdirSync(transcripts, { recursive: true });
    fs.writeFileSync(
      path.join(transcripts, 'session.jsonl'),
      JSON.stringify({ type: 'user', timestamp: '2026-07-05T10:00:00.000Z', message: { role: 'user', content: 'a prompt' } }),
    );
    const out = execFileSync(process.execPath, [SCRIPT, '--root', root, '--transcripts', transcripts, '--report']).toString();
    assert.ok(out.includes('1 session(s), 1 recoverable'));
    assert.equal(fs.existsSync(path.join(root, 'session-log')), false);
  } finally {
    cleanup(root);
  }
});
