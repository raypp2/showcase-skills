# Backfilling an existing project's history

**Most setups can ignore this file** — it only matters the first time `/showcase-log`
runs on a project that already had work happen on it before logging was turned on.
Brand-new projects have no history to recover, so this is a no-op for them.

## Why this exists

Claude Code transcripts (`~/.claude/projects/<flattened-path>/*.jsonl`) are the only
surviving record of everything said before logging existed on this project — and
they don't last. Anthropic deletes them after roughly 30 days, and long sessions get
compacted before that, summarizing away exact wording even within the retention
window. Once either happens, the original prompts, the reasoning behind decisions,
and the patterns in how the project was actually worked are gone for good — the same
loss `usage-snapshot.mjs` exists to prevent for token costs, just for the narrative
side instead. Turning logging on **now** and backfilling whatever's still recoverable
is strictly better than starting the log empty and losing that history permanently.

## When this runs

As part of normal `/showcase-log` setup, automatically, no extra question — same as
the legacy-layout migration in [MIGRATION.md](MIGRATION.md). It applies when:

- `session-log/session-log.md` does not already exist (a fresh install, not a re-run
  or upgrade), **and**
- `~/.claude/projects/<flattened-path>/` exists and contains at least one recoverable
  user turn, where `<flattened-path>` is the project root with every non-alphanumeric
  character replaced by `-` (the same convention `usage-snapshot.mjs` uses to find
  its transcripts).

If neither condition holds, skip this entirely and create the empty `session-log.md`
skeleton as normal.

## Step 1: Run the extraction

Run the skill's `scripts/backfill-from-history.mjs` against the project root (it can
be run directly from the skill directory — it doesn't need to be "installed" into
`_scripts/` first, the same way templates are read straight from `assets/` during
generation):

```bash
node <skill-dir>/scripts/backfill-from-history.mjs --root <project-root>
```

This writes `session-log/.backfill-source.json`: every transcript session for this
project, each with its ordered *real* user turns (verbatim text + timestamp,
slash-command echoes and tool-result continuations already filtered out) and the
file paths touched by Edit/Write/NotebookEdit before the next turn. It is purely
mechanical extraction — it does not group turns into requests or write any
narrative. That judgment is yours, below.

## Step 2: Check the scale before drafting

Count the total turns across all sessions in the extraction.

- **Under ~150 turns:** just proceed to Step 3, no need to ask.
- **Over ~150 turns:** this is the one justified exception to "setup asks exactly one
  question." Tell the user the scale and let them scope it, e.g.: *"Found 347
  recoverable prompts across 12 sessions going back to March 3rd — want me to
  backfill all of it, or just the last few weeks?"* Drafting hundreds of entries is
  slow and token-heavy; respect what they choose.

## Step 3: Draft entries

For each session, in chronological order, read its turns and write session-log
entries in the standard grammar (the heading format and fields-by-tier table are in
`SKILL.md`'s Logging Block), at whatever detail tier was chosen in Step 2 of
`SKILL.md`'s setup:

- **Group turns into entries the way a live logger would** — several consecutive
  turns that are really one back-and-forth request (a clarifying question and its
  answer, a correction, a multi-step build) become **one** entry with multiple
  `>` blockquotes and a `Context:` line, not one entry per turn. Use the same
  judgment live logging uses; the extraction gives you the raw material, not the
  boundaries.
- **Use the real timestamps** from the extraction for each entry's heading — never
  estimate. If a session's turns span a heading gap of more than a few hours,
  consider whether it's actually two separate sessions worth of work and add a
  `--- session ... ---` marker between them.
- **Actions**, when the tier includes them, come from the `files` touched on each
  turn in the extraction — a reasonable starting point, not a guarantee of
  completeness (the extraction only sees Edit/Write/NotebookEdit calls, not every
  side effect).
- **Outcome / Key Decisions**, when present, must be inferable from the prompt and
  files touched alone — don't fabricate reasoning you can't actually see. A thinner
  Outcome line is honest; an invented one isn't.
- **Skip the current session's own setup request** — the turn(s) where the user
  asked to turn logging on. That request is never logged (same rule as live
  setup), and it's always the last thing in the current session's transcript.
- **Prompts are still verbatim, always** — this is the entire point of doing this
  before the transcripts age out. Copy the extraction's `text` field exactly.

## Step 4: Mark what was reconstructed

Immediately after the `## Interaction Log` heading, before the backfilled entries,
add one note (not per-entry — keep the entries themselves clean and identical in
shape to live-logged ones):

```markdown
> _Entries below dated before YYYY-MM-DD were reconstructed from Claude Code
> transcript history (backfilled on YYYY-MM-DD). Detail may be lighter than
> live-logged entries — any turns already outside the ~30-day transcript window, or
> summarized away by context compaction, could not be recovered._
```

Fill in the earliest recovered date and today's date.

## Step 5: Clean up and report

Delete `session-log/.backfill-source.json` — it's scratch input, not part of the
log. Fold the result into the normal Step 9/10 setup report as one short clause,
e.g.: `Logging on for this project (standard detail) — backfilled 34 entries from
existing history back to July 2nd.` Don't add a separate report block for this.
