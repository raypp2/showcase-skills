// cost-report.test.mjs — smoke tests for cost-report.mjs, in particular the
// fix that redefined the "Today" window from Claude Code session ID to
// calendar day: a session ID persists across every resume of the same
// conversation, so a project worked on intermittently over months in one
// long-running thread used to report the exact same figure for "this
// session" as "all time."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeScratchDir, cleanup } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'cost-report.mjs');

function writeUsage(root, rows) {
  fs.mkdirSync(path.join(root, 'session-log', 'usage'), { recursive: true });
  fs.writeFileSync(path.join(root, 'session-log', 'usage', 'usage.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n'));
}

test('"Today" reflects only the latest calendar day, not the whole (single, long-running) session', () => {
  const root = makeScratchDir('cost-report-today');
  try {
    // All rows share one Claude Code session id, spanning several months —
    // the exact shape that made the old session-id-based window meaningless.
    writeUsage(root, [
      { id: 'm1', ts: '2026-04-16T10:00:00.000Z', session: 's1', model: 'claude-sonnet-5', input: 1, output: 1, cache_write: 0, cache_read: 0, cost_usd: 100 },
      { id: 'm2', ts: '2026-06-01T10:00:00.000Z', session: 's1', model: 'claude-sonnet-5', input: 1, output: 1, cache_write: 0, cache_read: 0, cost_usd: 200 },
      { id: 'm3', ts: '2026-07-06T09:00:00.000Z', session: 's1', model: 'claude-sonnet-5', input: 1, output: 1, cache_write: 0, cache_read: 0, cost_usd: 12.34 },
    ]);
    const out = execFileSync(process.execPath, [SCRIPT, '--root', root]).toString();
    assert.ok(out.includes('Today'), 'window label should read "Today", not "This session"');
    assert.ok(!out.includes('This session'));
    const todayLine = out.split('\n').find((l) => l.includes('Today'));
    assert.ok(todayLine.includes('$12.34'), `Today should total only the latest day's cost, got: ${todayLine}`);
    const allTimeLine = out.split('\n').find((l) => l.includes('All time'));
    assert.ok(allTimeLine.includes('$312.34'), `All time should total every row, got: ${allTimeLine}`);
  } finally {
    cleanup(root);
  }
});
