// archiver.test.mjs — smoke tests for archive-session-log.mjs. Covers the
// two properties that matter most for a script whose whole job is not
// losing data: entry conservation across a real split, and dry-run/idempotent
// re-run making no unexpected changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeScratchDir, cleanup, fixtureLog, countHeadings } from './helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'archive-session-log.mjs');

function corpusText(root) {
  const archiveDir = path.join(root, 'session-log', 'archive');
  const archiveTexts = fs.existsSync(archiveDir)
    ? fs.readdirSync(archiveDir).filter((f) => f.endsWith('.md')).map((f) => fs.readFileSync(path.join(archiveDir, f), 'utf8'))
    : [];
  const liveText = fs.readFileSync(path.join(root, 'session-log', 'session-log.md'), 'utf8');
  return [...archiveTexts, liveText];
}

test('archiver conserves every entry across a real split', () => {
  const root = makeScratchDir('archive-conserve');
  try {
    fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
    fs.writeFileSync(path.join(root, 'session-log', 'session-log.md'), fixtureLog(50));
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    assert.equal(countHeadings(...corpusText(root)), 50);
    // Live file should be the lean tail, not the whole corpus.
    const liveText = fs.readFileSync(path.join(root, 'session-log', 'session-log.md'), 'utf8');
    assert.ok(countHeadings(liveText) < 50, 'live file should be rolled down to a tail');
  } finally {
    cleanup(root);
  }
});

test('archiver is idempotent on immediate re-run', () => {
  const root = makeScratchDir('archive-idempotent');
  try {
    fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
    fs.writeFileSync(path.join(root, 'session-log', 'session-log.md'), fixtureLog(50));
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    const after1 = countHeadings(...corpusText(root));
    execFileSync(process.execPath, [SCRIPT, '--root', root]);
    const after2 = countHeadings(...corpusText(root));
    assert.equal(after1, after2);
    assert.equal(after2, 50);
  } finally {
    cleanup(root);
  }
});

test('archiver --dry-run makes no changes to disk', () => {
  const root = makeScratchDir('archive-dryrun');
  try {
    fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
    const original = fixtureLog(50);
    fs.writeFileSync(path.join(root, 'session-log', 'session-log.md'), original);
    execFileSync(process.execPath, [SCRIPT, '--root', root, '--dry-run']);
    assert.equal(fs.readFileSync(path.join(root, 'session-log', 'session-log.md'), 'utf8'), original);
    assert.equal(fs.existsSync(path.join(root, 'session-log', 'archive')), false);
  } finally {
    cleanup(root);
  }
});

test('archiver --auto self-gates below the archiving threshold without error', () => {
  const root = makeScratchDir('archive-auto-small');
  try {
    fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
    fs.writeFileSync(path.join(root, 'session-log', 'session-log.md'), fixtureLog(5));
    execFileSync(process.execPath, [SCRIPT, '--root', root, '--auto']);
    assert.equal(countHeadings(fs.readFileSync(path.join(root, 'session-log', 'session-log.md'), 'utf8')), 5);
    assert.ok(fs.existsSync(path.join(root, 'session-log', 'usage', '.archive-state.json')), 'debounce stamp should be written');
  } finally {
    cleanup(root);
  }
});

test('archiver --auto debounces a second call within 24h', () => {
  const root = makeScratchDir('archive-auto-debounce');
  try {
    fs.mkdirSync(path.join(root, 'session-log'), { recursive: true });
    fs.writeFileSync(path.join(root, 'session-log', 'session-log.md'), fixtureLog(50));
    execFileSync(process.execPath, [SCRIPT, '--root', root, '--auto']);
    fs.rmSync(path.join(root, 'session-log', 'session-log.md'));
    // If the second call didn't debounce, it would try to read the now-missing
    // live file and throw — so a clean exit here proves it skipped the check.
    execFileSync(process.execPath, [SCRIPT, '--root', root, '--auto']);
  } finally {
    cleanup(root);
  }
});
