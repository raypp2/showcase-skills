---
name: showcase-log
description: "Preserve what actually happens on a project before it's gone — Claude Code deletes transcripts after ~30 days and compacts long sessions before that, erasing the prompts and decisions that show how the user really works. This skill turns that history into a permanent structured log (verbatim prompts, decisions, cost) and turns it into on-demand payoffs: a cost report and a mobile-friendly interactive recap page with a section picker (daily activity, cost, milestones, decisions, optional AI analysis). It's the always-on data layer for the showcase family — other showcase skills (like showcase-project) build from this log instead of reconstructing history from memory. On an existing project it also backfills recoverable transcript history, so turning it on late still recovers most of it. Run this at the start of any project — the earlier it's on, the less is lost. Use this skill when the user says 'showcase log', 'start logging', 'turn on the log', 'set up the project log', or runs /showcase-log."
metadata:
  version: "2.0.0"
---

# Showcase Log Setup (v2)

## Why this exists

Everything that makes Claude useful on a project — the exact prompt that unlocked
something, the reasoning behind a decision, the pattern in how the user asks for
things — lives only in the chat, and chat is lossy by design. Claude Code deletes
transcripts after roughly 30 days, and long sessions get **compacted** well before
that, summarizing away exact wording to save context. Once either happens, that
history is gone: not archived somewhere, not recoverable, just gone. For anyone
trying to document what a project actually was, improve how they prompt, or show
someone else how they work with Claude, that's the raw material disappearing before
it can ever be used.

This skill turns the raw material into something permanent — a structured,
plain-text log of every interaction (verbatim prompts, decisions, cost) — and then
turns *that* into things worth having on their own: an instant cost report and a
mobile-friendly recap page, which does most of the work of reporting back to the
user. The log is the mechanism; the payoffs are the point. It's also the foundation
the rest of the **showcase** family
builds on: `/showcase-project`'s curated, interview-driven story page can only
quote real prompts and reconstruct a real timeline if this log was running to
capture them — without it, that skill is stuck reconstructing history from memory
and file timestamps. Turning this on isn't just about today's cost report; it's what
makes every *later* demonstration of the work possible at all. And because the risk
is real for projects that already have history sitting in transcripts about to age
out, turning this on for the first time on an existing project also **backfills**
whatever's still recoverable (Step 4) rather than starting the log empty and losing
that history for good.

Setup asks **no questions** in the common case — detail defaults to standard, and
the user can ask to log lighter or deeper at any time afterward. The only exception:
an unusually large amount of history to backfill gets a quick scoping question — see
Step 4. Do not narrate each step — run them and give the final report (the locked
emit message in the last step).

Everything lives in one folder, `session-log/`, so there is exactly one thing to gitignore
and one thing to point people at:

```
session-log/
  README.md             plain-English guide to the folder for anyone browsing the repo
  session-log.md      live entries + auto-generated header/index
  archive/*.md          older entries rolled off session-log.md, chunked by date range
  usage/usage.jsonl      exact token usage harvested from Claude Code transcripts
  usage/summary.md        human-readable cost rollup
  YYYY-MM-DD-Recap.html   generated overview: daily activity, cost, milestones, key decisions —
                            one per generation day, accumulating rather than overwriting
```

| Piece | Purpose |
|---|---|
| Logging block in `CLAUDE.md` | Claude appends a structured entry to `session-log/session-log.md` after every request, and knows how to trigger the outputs below |
| `_scripts/backfill-from-history.mjs` | One-time, on first setup: extracts recoverable prompts + timestamps from this project's Claude Code transcripts before they age out, for Claude to turn into entries (see [BACKFILL.md](BACKFILL.md)) |
| `_scripts/enrich-log-dates.mjs` | Adds real dates to entries that already exist but have none — a pre-v2 numbered log (`### #N — ...`) that Step 1 just migrated into place — by matching each entry's verbatim prompt against transcript turns (see [BACKFILL.md](BACKFILL.md#enriching-an-already-migrated-log)) |
| `_scripts/check-log-coverage.mjs` | Audits transcripts against `session-log/` and flags real prompts that never got logged, while there's still time to fix it — runs automatically via hooks, same debounce pattern as the usage snapshot |
| `_scripts/archive-session-log.mjs` | Rolls old entries into `session-log/archive/`; keeps the live file lean. Runs automatically via hooks (`--auto`, self-gating below ~40 entries) — the ~40-entry rule in the Logging Block is now a same-day backstop, not the primary trigger |
| `_scripts/usage-snapshot.mjs` | Harvests exact token usage from Claude Code transcripts before the ~30-day transcript cleanup erases them |
| `_scripts/cost-report.mjs` | Prints cost by model and by time window (today / 7d / 30d / all-time), in dollars |
| `_scripts/generate-recap.mjs` | Writes `session-log/YYYY-MM-DD-Recap.html` (dated to the day it runs) — the main report back to the user: mobile-friendly interactive overview with daily bars, cost tables, milestones, and key decisions (deterministic, and individually optional via a section picker), plus placeholder sections for AI analysis (workstreams, timeline, patterns, findings) |
| `_scripts/lib/*.mjs` | Shared path/parsing/usage/transcript helpers the scripts above import — keeps them from drifting out of sync |
| `_scripts/.showcase-log-version` | The skill version these scripts were copied from — the only way to tell an installed copy is behind the current source, since re-running setup is what refreshes it |
| `assets/recap-template.html` | HTML shell the generator fills in |
| `assets/logging-block-template.md` | The Logging Block's actual text — Step 3 reads it from the skill directory and substitutes `{{DETAIL_TIER}}`; never installed into the project |
| `assets/session-log-readme-template.md` | The Folder README's actual text — Step 5 copies it straight to `session-log/README.md`; never installed into the project |
| Hooks in `.claude/settings.json` | Run the usage snapshot, archiver, and coverage check deterministically (SessionStart + Stop) — no model or user cooperation needed |

The deterministic base is a **light, mechanical** layer distinct from `/showcase-project`:
daily activity and cost, assembled by script — no narrative writing, no era inference.
Declared milestones and logged decisions aren't a standalone deterministic section; they
surface through the AI-authored "Milestones & capabilities timeline" (milestones) and
remain in the log itself (decisions) rather than getting their own recap section. The
recap also supports optional **AI-analyzed sections** (workstreams, timeline, patterns,
findings) that Claude fills in after the script generates the base — the user picks which
sections to include via a section picker.
`/showcase-project`'s curated, interview-driven story page is still the right tool when
someone wants a polished, shareable narrative — the two are complementary, not competing.

---

## Steps

### Step 1: Migrate a legacy layout, if present (optional)

**Almost always skip this.** Only relevant when upgrading a project set up with the
pre-2.1 flat layout — if `session-log.md`, `session-log-archive/`, or `session-usage/`
exist at the project root, follow [MIGRATION.md](MIGRATION.md) to move them into the
unified `session-log/` folder before continuing. A brand-new project (none of those paths
present) or one already on the new layout needs nothing here — go straight to Step 2.

### Step 2: Detail tier — defaults to standard, no question

If `CLAUDE.md` already contains `<!-- SHOWCASE-LOGGING-START -->` with a `Detail tier:`
line, reuse that tier (an existing customization is preserved, never silently reset).

Otherwise, just set it to **standard** — verbatim prompts plus what was built, decided, and
fixed; supports the recap page and cost/decision outputs. Don't ask. The user can switch to
**lite** (prompts + one-line outcomes, minimal overhead) or **deep** (+ reasoning, sources,
verification) any time afterward just by saying "log lighter" or "log deeper" — see the
Logging Block's on-demand outputs.

### Step 3: CLAUDE.md

Read `assets/logging-block-template.md` from the skill directory and substitute
`{{DETAIL_TIER}}` with the tier chosen in Step 2 — this rendered text is the Logging Block.

- **No `CLAUDE.md`:** create it containing only the Logging Block.
- **Exists, no `<!-- SHOWCASE-LOGGING-START -->`:** append the Logging Block (blank line before it).
- **Exists with the marker:** replace everything between `<!-- SHOWCASE-LOGGING-START -->`
  and `<!-- SHOWCASE-LOGGING-END -->` (inclusive) with the current Logging Block — this
  upgrades older installs in place. Preserve the tier if one was already set.

### Step 4: Backfill or enrich from history, if this is an existing project

Two independent checks, both automatic — same reasoning as Step 1's migration, no question
asked unless BACKFILL.md's scale threshold applies:

**A. No `session-log/session-log.md` yet** (brand-new project, or nothing for Step 1 to
migrate). Check for recoverable history: does `~/.claude/projects/<flattened-path>/` exist
and contain at least one real user turn, where `<flattened-path>` is the project root with
every non-alphanumeric character replaced by `-`? If not, skip to Step 5. If so, follow
[BACKFILL.md](BACKFILL.md): run `scripts/backfill-from-history.mjs` to extract verbatim
prompts + timestamps, then draft them into `session-log/session-log.md` at the tier chosen
in Step 2.

**B. `session-log/session-log.md` already exists.** Most of the time this means a re-run or
upgrade with nothing to do — but it's also what a v1-format log looks like right after
Step 1 just migrated it into place, and that case has content but needs dates. Run
`node scripts/enrich-log-dates.mjs --report` (from the skill directory, same as backfill)
to check:
- **Reports zero undated entries** — nothing to do, skip to Step 5.
- **Reports undated entries and at least one recoverable transcript turn** — run
  `node scripts/enrich-log-dates.mjs` for real. It matches each undated entry's verbatim
  prompt against transcript turns and stamps a real date into its heading in place, without
  touching anything else about the entry — see
  [BACKFILL.md](BACKFILL.md#enriching-an-already-migrated-log).
- **Reports undated entries but no recoverable transcript turns** (history already aged
  out) — don't fabricate dates. Leave the entries as they are, but say so in the Step 10
  report so the user knows why Daily Activity will stay empty for them until more history
  exists.

Skipping this check is the exact bug this step exists to close: an entry with content but no
date silently breaks every deterministic recap feature keyed on date (daily activity chart,
day drill-downs, the workstreams gantt), with nothing in setup's own output to say so.

### Step 5: session-log/session-log.md and session-log/README.md

If `session-log/session-log.md` is still missing (Step 4 found no history to backfill),
create it with:

```markdown
# Project Log

---

## Interaction Log
```

If it exists (created just now by Step 4, or from any earlier version), leave its entries
alone — v1 numbered entries, v2 dated entries, and backfilled entries coexist; the archiver
understands all of them.

Then copy `assets/session-log-readme-template.md` from the skill directory to
`session-log/README.md`, overwriting any existing copy (it's a generated guide owned by the
skill, safe to refresh). This gives anyone browsing the repo — teammates, future you, a
reviewer — a plain-English explanation of what the folder is and how to drive it.

### Step 6: Git hygiene

`session-log/` is gitignored by default for **privacy, not just tidiness** — prompts are
verbatim, so they can carry anything the user typed, including things they'd never want
pushed to a shared remote without deciding to. Sharing it is something the user actively
opts into (dropping the gitignore line, or committing anyway); it is never the default.

**If the directory is already inside a git repository:**

Ensure `.gitignore` (create if needed) contains `/session-log/`. Remove any leftover
`/session-log.md`, `/session-log-archive/`, `/session-usage/` lines from a prior install —
the single folder entry supersedes them.

That's the whole job: make sure a *fresh* setup doesn't start tracking the log. If
`session-log/` (or its pre-2.1 predecessors) is already committed — the user tracked it on
purpose, or a prior version of this skill didn't have this rule — leave it alone. Untracking
files someone already chose to commit isn't this skill's call to make; if they want it
untracked, that's on them to do.

**If it's not a git repository yet:** there's no `.gitignore` to write, and that's fine — the
user may well turn logging on before ever running `git init`. Nothing to do here now, but
the Logging Block below carries a standing rule for exactly this: if git shows up later,
`/session-log/` gets gitignored automatically at that point, without needing to ask or
re-run this skill.

### Step 7: Install scripts, lib, and templates

Copy from this skill's directory into the project, overwriting existing copies (these
files are owned by the skill and refreshed on re-setup):
- `scripts/*.mjs` → `_scripts/*.mjs` (includes `backfill-from-history.mjs` and
  `enrich-log-dates.mjs` — Step 4 ran whichever of these applied directly from the skill
  directory before this point, so this is just catching the project's own copy up for any
  future re-run)
- `scripts/lib/*.mjs` → `_scripts/lib/*.mjs`
- `assets/*-template.html` → `assets/*-template.html`

Then write `_scripts/.showcase-log-version` containing just this skill's `metadata.version`
from its own frontmatter (e.g. `2.0.0`), overwriting any existing copy. These files are frozen forks
once copied — a project doesn't pick up later fixes to the skill until `/showcase-log` runs
again — so this stamp is how anyone (or Claude, in a future session) can tell whether an
installed copy is behind the skill's current source, instead of having no way to tell at all.

### Step 8: Install hooks

Merge the following into the project's `.claude/settings.json` (create the file with just
this content if it doesn't exist). **Merge, never overwrite**: if a `hooks` object or these
event arrays already exist, append only the entries that aren't already present — skip any
command that's already listed for that event (don't duplicate on re-setup).

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node _scripts/usage-snapshot.mjs --auto" }] },
      { "hooks": [{ "type": "command", "command": "node _scripts/archive-session-log.mjs --auto" }] },
      { "hooks": [{ "type": "command", "command": "node _scripts/check-log-coverage.mjs --auto" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node _scripts/usage-snapshot.mjs --auto" }] },
      { "hooks": [{ "type": "command", "command": "node _scripts/archive-session-log.mjs --auto" }] },
      { "hooks": [{ "type": "command", "command": "node _scripts/check-log-coverage.mjs --auto" }] }
    ]
  }
}
```

Why hooks: the harness executes them deterministically, so usage harvesting, archiving, and
coverage checking all happen even if the user (or the model) never thinks about it. Each
`--auto` self-debounces (exits in well under 100ms combined unless its own last real check
is >24h old), so the per-turn Stop hook stays effectively free. This is the same reasoning
applied three times over: don't trust an instruction alone for anything where silently
skipping it would be a real, permanent loss.

### Step 9: Initial snapshot

Run `node _scripts/usage-snapshot.mjs` once now. This captures any transcript history the
project already has before it ages out. If it reports "no transcript folder", that's fine —
a brand-new project has no history yet.

### Step 10: Report

Print **exactly** this (fill in the tier if it differs from standard):

```
Logging on for this project (<tier> detail).
  💰 "what did this cost so far?"
  📖 "make a recap"
  🎚️ Change detail level — say "log lighter/deeper"
```

This is the entire report — no checklist, no file paths. If something in Steps 1–9 needed
migration or fixing (legacy layout moved, an already-tracked file untracked, history
backfilled or enriched), fold one short clause into this message rather than adding a second
block, e.g.:
`Logging on for this project (standard detail) — migrated your old log layout into session-log/.`
`Logging on for this project (standard detail) — backfilled 34 entries from existing history back to July 2nd.`
`Logging on for this project (standard detail) — migrated your old log layout into session-log/ and backfilled dates onto 41 existing entries from transcript history.`
`Logging on for this project (standard detail) — migrated your old log layout into session-log/, but 41 entries don't have dates and transcript history has already aged out, so Daily Activity won't populate for them yet.`

---

## The Logging Block

The full text lives in [`assets/logging-block-template.md`](assets/logging-block-template.md)
— Step 3 reads it directly from the skill directory and substitutes `{{DETAIL_TIER}}` with
the tier chosen in Step 2. That file has the actual entry-format grammar, rules, and
on-demand trigger phrases; nothing here duplicates it, so there's exactly one place to
update when any of that changes.

## The Folder README

The full text lives in
[`assets/session-log-readme-template.md`](assets/session-log-readme-template.md) — Step 5
copies it straight to `session-log/README.md`, no substitution needed (it's the same for
every project).

---

## Important

- Setup asks no questions by default — detail tier defaults to standard, adjustable anytime
  via "log lighter/deeper". The only interaction at all is the rare Step 4 scoping question
  on a project with an unusually large amount of history to backfill.
- Do NOT log this setup interaction in session-log.md. Logging starts with the user's next
  request — and if Step 4 backfilled prior history, it must skip that same setup request
  wherever it appears in the transcript being mined, not just in the live conversation.
- Never modify the user's global `~/.claude/settings.json` — hooks go in the project's `.claude/settings.json` only.
- Costs shown by any of these outputs are API-equivalent value at list prices, not billed spend — say so if the user asks about the numbers.
- Each recap is written to `session-log/YYYY-MM-DD-Recap.html`, dated to the day it's
  generated (never hand-edited, never diffed/merged) — treat each one as a disposable
  snapshot over `session-log/`, not a second source of truth. Regenerating later the same
  day overwrites that day's file; a different day produces a new file alongside the old
  ones.

## Recap Generation

Building a recap (section picker, base generation, AI-authored sections,
delivery) is on-demand and substantial enough to live on its own — follow
[RECAP.md](RECAP.md) in full when a recap is actually requested, rather than carrying its
detail in every session's context.

