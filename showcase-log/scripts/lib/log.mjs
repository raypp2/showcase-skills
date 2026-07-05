// log.mjs — shared parsing for session-log.md + archive/*.md, used by
// decision-digest.mjs, generate-milestones.mjs, and generate-recap.mjs so
// they can't drift out of sync on how entries/markers are read.
import fs from 'node:fs';
import path from 'node:path';

// v2 date-ID headings (`### YYYY-MM-DD HH:MM–HH:MM — desc`) and legacy v1
// numbered headings (`### #N — desc`, optionally with a date backfilled in,
// `### #N — YYYY-MM-DD [HH:MM–HH:MM] desc`) are both accepted.
const ENTRY_RE = /^### (\d{4}-\d{2}-\d{2}|#\d+)\b/;
const DATE_RE = /(\d{4}-\d{2}-\d{2})/;
const TIME_RE = /(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/;
const FIELD_RE = /^\*\*[A-Za-z][A-Za-z &]*:\*\*/;
const MILESTONE_RE = /^>?\s*\*\*Milestone \((\d{4}-\d{2}-\d{2})\):\*\*\s*(.*)$/;
const SESSION_RE = /^--- session (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) \(([^)]+)\) ---$/;

function corpusFiles(P) {
  const files = [];
  if (fs.existsSync(P.ARCHIVE_DIR)) {
    files.push(...fs.readdirSync(P.ARCHIVE_DIR).filter((f) => f.endsWith('.md')).sort()
      .map((f) => path.join(P.ARCHIVE_DIR, f)));
  }
  if (fs.existsSync(P.LIVE_FILE)) files.push(P.LIVE_FILE);
  return files;
}

/** Extract a field's content from a raw entry block. Handles both
 * `**Field:** inline text` and `**Field:**\n- bullet\n- bullet` shapes.
 * Returns an array of lines (bullets stripped of their leading `- `, or the
 * single inline string) — empty array if the field isn't present. */
function extractField(raw, fieldName) {
  const lines = raw.split('\n');
  const startRe = new RegExp(`^\\*\\*${fieldName}:\\*\\*`);
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startRe.test(lines[i].trim())) { idx = i; break; }
  }
  if (idx === -1) return [];
  const inlineTail = lines[idx].trim().replace(startRe, '').trim();
  const span = [];
  if (inlineTail) span.push(inlineTail);
  for (let i = idx + 1; i < lines.length; i++) {
    if (FIELD_RE.test(lines[i].trim())) break;
    span.push(lines[i]);
  }
  const bullets = span
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim());
  if (bullets.length) return bullets;
  const text = span.join(' ').trim();
  return text ? [text] : [];
}

/** Parse the full corpus (archive chunks, oldest first, then the live file)
 * into ordered entries. Each entry: { position, raw, heading, date, start,
 * end, keyDecisions[], outcome }. */
export function loadEntries(P) {
  const entries = [];
  let position = 0;
  for (const fp of corpusFiles(P)) {
    const lines = fs.readFileSync(fp, 'utf8').split('\n');
    let cur = null;
    const flush = () => {
      if (!cur) return;
      const raw = cur.join('\n').replace(/\s+$/, '');
      const heading = cur[0];
      const dateMatch = heading.match(DATE_RE);
      const timeMatch = heading.match(TIME_RE);
      position++;
      entries.push({
        position,
        raw,
        heading,
        date: dateMatch ? dateMatch[1] : null,
        start: timeMatch ? timeMatch[1] : null,
        end: timeMatch ? timeMatch[2] : null,
        keyDecisions: extractField(raw, 'Key Decisions'),
        outcome: extractField(raw, 'Outcome')[0] || null,
      });
    };
    for (const line of lines) {
      if (ENTRY_RE.test(line)) { flush(); cur = [line]; }
      else if (cur) cur.push(line);
    }
    flush();
  }
  return entries;
}

/** Strip the heading down to just its human description, regardless of which
 * of the three heading shapes it is (pure v2 date-ID, legacy `#N`, or a
 * legacy `#N` with a date backfilled in — bracketed or bare time range,
 * present or absent). */
export function entryLabel(heading) {
  let s = heading.replace(/^###\s*/, '');
  s = s.replace(/^#\d+\s*—\s*/, '');
  s = s.replace(/^\d{4}-\d{2}-\d{2}\s*/, '');
  s = s.replace(/^\[?\d{2}:\d{2}\s*[–-]\s*\d{2}:\d{2}(?:\s*\([^)]*\))?(?:\s*\+\s*\d{2}:\d{2}\s*[–-]\s*\d{2}:\d{2}(?:\s*\([^)]*\))?)*\]?\s*/, '');
  s = s.replace(/^—\s*/, '');
  return s.trim();
}

/** Scan the full corpus for milestone and session-boundary marker lines.
 * Order-independent of entries — each marker carries its own date. */
export function loadMarkers(P) {
  const milestones = [];
  const sessions = [];
  for (const fp of corpusFiles(P)) {
    for (const line of fs.readFileSync(fp, 'utf8').split('\n')) {
      const mm = line.match(MILESTONE_RE);
      if (mm) { milestones.push({ date: mm[1], text: mm[2].replace(/\*$/, '').trim() }); continue; }
      const sm = line.match(SESSION_RE);
      if (sm) sessions.push({ date: sm[1], time: sm[2], model: sm[3] });
    }
  }
  milestones.sort((a, b) => a.date.localeCompare(b.date));
  sessions.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { milestones, sessions };
}
