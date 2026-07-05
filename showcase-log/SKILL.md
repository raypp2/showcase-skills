---
name: showcase-log
version: 2.0.0
description: "Preserve what actually happens on a project before it's gone — Claude Code's transcripts are deleted after ~30 days and long sessions get compacted well before that, silently erasing the exact prompts, decisions, and patterns that show how the user really works. This skill turns that history into a permanent structured log (verbatim prompts, decisions, cost) and turns the log into on-demand payoffs: a cost report, a decision digest, and a mobile-friendly interactive recap page. It's the always-on data layer of the showcase family — the same log is what lets other showcase skills (like showcase-project) build deeper, curated demonstrations of the user's work later, instead of reconstructing it from memory. On an existing project it also backfills whatever transcript history is still recoverable, so turning this on late still saves most of what would otherwise be lost. Setup asks no questions by default. Run this at the start of any project — the earlier it's on, the less is lost. Use this skill when the user says 'showcase log', 'start logging', 'turn on the log', 'set up the project log', or runs /showcase-log."
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
turns *that* into things worth having on their own: an instant cost report, a
decision digest, and a mobile-friendly recap page. The log is the mechanism; the
payoffs are the point. It's also the foundation the rest of the **showcase** family
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
  recap.html            generated overview: daily activity, cost, milestones, key decisions
```

| Piece | Purpose |
|---|---|
| Logging block in `CLAUDE.md` | Claude appends a structured entry to `session-log/session-log.md` after every request, and knows how to trigger the outputs below |
| `_scripts/backfill-from-history.mjs` | One-time, on first setup: extracts recoverable prompts + timestamps from this project's Claude Code transcripts before they age out, for Claude to turn into entries (see [BACKFILL.md](BACKFILL.md)) |
| `_scripts/archive-session-log.mjs` | Rolls old entries into `session-log/archive/`; keeps the live file lean |
| `_scripts/usage-snapshot.mjs` | Harvests exact token usage from Claude Code transcripts before the ~30-day transcript cleanup erases them |
| `_scripts/cost-report.mjs` | Prints cost by model and by time window (this session / 7d / 30d / all-time), in dollars |
| `_scripts/decision-digest.mjs` | Prints every logged `Key Decisions` bullet, dated — a running engineering-decisions log |
| `_scripts/generate-recap.mjs` | Writes `session-log/recap.html` — mobile-friendly interactive overview with daily bars, cost tables, milestones, decisions (deterministic), plus placeholder sections for AI analysis (workstreams, patterns, recommendations) |
| `_scripts/lib/*.mjs` | Shared path/parsing/usage helpers the scripts above import — keeps them from drifting out of sync |
| `assets/recap-template.html` | HTML shell the generator fills in |
| `assets/recap-sample-ci.html` | Reference sample of a complete recap with all AI sections filled in |
| Hooks in `.claude/settings.json` | Run the usage snapshot deterministically (SessionStart + Stop) — no model or user cooperation needed |

The deterministic base is a **light, mechanical** layer distinct from `/showcase-project`:
dollars, declared milestones, and logged decisions, assembled by script. There is no
separate milestone page — milestones are one section within the recap (the section picker
below lets someone get just that section if that's all they want), so there's exactly one
generated output to point people at. The recap also supports optional **AI-analyzed
sections** (workstreams, patterns, recommendations) that Claude fills in after the script
generates the base — the user picks which sections to include via a section picker.
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

- **No `CLAUDE.md`:** create it containing only the Logging Block below.
- **Exists, no `<!-- SHOWCASE-LOGGING-START -->`:** append the Logging Block (blank line before it).
- **Exists with the marker:** replace everything between `<!-- SHOWCASE-LOGGING-START -->`
  and `<!-- SHOWCASE-LOGGING-END -->` (inclusive) with the current Logging Block — this
  upgrades older installs in place. Preserve the tier if one was already set.

In the block, set the `Detail tier:` line to the chosen tier.

### Step 4: Backfill from history, if this is an existing project

**Skip if `session-log/session-log.md` already exists** (a re-run or upgrade — nothing to
backfill, the log is already live). Otherwise check for recoverable history: does
`~/.claude/projects/<flattened-path>/` exist and contain at least one real user turn, where
`<flattened-path>` is the project root with every non-alphanumeric character replaced by
`-`? If not — brand-new project, no history — skip to Step 5.

If recoverable history exists, follow [BACKFILL.md](BACKFILL.md): run
`scripts/backfill-from-history.mjs` to extract verbatim prompts + timestamps, then draft them
into `session-log/session-log.md` at the tier chosen in Step 2. This is automatic, same as
Step 1's migration — the one exception is an unusually large history (BACKFILL.md's
threshold), which gets a quick scoping question before drafting hundreds of entries.

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

Then write `session-log/README.md` from the **Folder README** template below, overwriting
any existing copy (it's a generated guide owned by the skill, safe to refresh). This gives
anyone browsing the repo — teammates, future you, a reviewer — a plain-English explanation
of what the folder is and how to drive it.

### Step 6: Git hygiene

`session-log/` is gitignored by default for **privacy, not just tidiness** — prompts are
verbatim, so they can carry anything the user typed, including things they'd never want
pushed to a shared remote without deciding to. Sharing it is something the user actively
opts into (dropping the gitignore line, or committing anyway); it is never the default.

**If the directory is already inside a git repository:**

1. Ensure `.gitignore` (create if needed) contains `/session-log/`. Remove any leftover
   `/session-log.md`, `/session-log-archive/`, `/session-usage/` lines from a prior install
   — the single folder entry supersedes them.
2. Untrack anything already committed under the old or new paths — a gitignore rule does
   not untrack existing files:
   ```bash
   git rm -r -q --cached session-log.md session-log-archive session-usage session-log 2>/dev/null || true
   ```
   If this untracked anything, tell the user it will show as a deletion in their next commit.

**If it's not a git repository yet:** there's no `.gitignore` to write, and that's fine — the
user may well turn logging on before ever running `git init`. Nothing to do here now, but
the Logging Block below carries a standing rule for exactly this: if git shows up later,
`/session-log/` gets gitignored automatically at that point, without needing to ask or
re-run this skill.

### Step 7: Install scripts, lib, and templates

Copy from this skill's directory into the project, overwriting existing copies (these
files are owned by the skill and refreshed on re-setup):
- `scripts/*.mjs` → `_scripts/*.mjs` (includes `backfill-from-history.mjs` — Step 4 ran it
  directly from the skill directory before this point, so this is just catching the
  project's own copy up for any future re-run)
- `scripts/lib/*.mjs` → `_scripts/lib/*.mjs`
- `assets/*-template.html` → `assets/*-template.html`

### Step 8: Install hooks

Merge the following into the project's `.claude/settings.json` (create the file with just
this content if it doesn't exist). **Merge, never overwrite**: if a `hooks` object or these
event arrays already exist, append the entries — and skip any that already invoke
`usage-snapshot.mjs` (don't duplicate on re-setup).

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node _scripts/usage-snapshot.mjs --auto" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node _scripts/usage-snapshot.mjs --auto" }] }
    ]
  }
}
```

Why hooks: the harness executes them deterministically, so usage is harvested even if the
user never thinks about transcript retention. `--auto` self-debounces (exits in ~50ms
unless the last real snapshot is >24h old), so the per-turn Stop hook is effectively free.

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
backfilled), fold one short clause into this message rather than adding a second block, e.g.:
`Logging on for this project (standard detail) — migrated your old log layout into session-log/.`
`Logging on for this project (standard detail) — backfilled 34 entries from existing history back to July 2nd.`

---

## The Logging Block

Insert exactly this into CLAUDE.md (with `Detail tier:` set appropriately):

```markdown
<!-- SHOWCASE-LOGGING-START -->
## Project Log

**Maintain a running log in `session-log/session-log.md`.** After completing each user
request (not during — finish the work first, then log), silently append an entry. Do not
ask permission. Do not mention you are logging.

**Detail tier: standard** <!-- lite | standard | deep — set by /showcase-log -->

Run `date "+%Y-%m-%d %H:%M"` when you begin work on a request so the entry records real
start and end times. Never estimate times from memory, and never number entries.

### Entry Format

Heading: `### YYYY-MM-DD HH:MM–HH:MM — Short description`

Fields by tier — lite: Prompt, Context, Outcome. standard: + Actions, Key Decisions,
Errors & Resolution, Model. deep: + Sources, Approach, Verification. Omit any field with
nothing to say, except Prompt (always present).

    ### 2026-07-02 14:32–14:47 — Dashboard build from tracker data

    **Prompt:**
    > [The user's message, verbatim and complete]

    **Context:** [only when the prompt answers a question you asked]
    Q: [the question and the options you offered] → A: [what they chose]

    **Outcome:** [one or two sentences: what was produced or changed]

    **Actions:**
    - [Created/Modified] `filename` — [what it is / what changed]

    **Key Decisions:**
    - [Non-obvious choices: library selection, data interpretation, scope]

    **Errors & Resolution:**
    - [Error] → [Resolution]

    **Model:** [model id — only when it differs from the previous entry]

### Rules

- **Prompts are verbatim** — complete, unedited, typos preserved. Never paraphrase, never
  elide with "...", never bracket-summarize. Multi-turn exchanges get one `>` blockquote
  per user turn, in order. The user's exact words are the most valuable data in this log;
  every other field may be economized, this one never.
- When the user's message answers a question you asked (including multiple-choice
  selections), record the question with the answer in **Context** — an answer without its
  question is unreadable later.
- Log every request, including clarifying exchanges and small corrections — the
  back-and-forth is part of the data. Do not log the logging itself or this setup.
- At the start of a new session, or when the model changes, append on its own line:
  `--- session YYYY-MM-DD HH:MM (model-id) ---`
- If the user declares a milestone, append: `> **Milestone (YYYY-MM-DD):** [their words]`.
  Never invent milestones yourself — phases are only visible in retrospect.
- When the live log exceeds ~40 entries, run `node _scripts/archive-session-log.mjs`
  (rolls old entries into `session-log/archive/` and refreshes the usage snapshot), then
  keep appending as normal.
- **`session-log/` is private by default** — prompts are verbatim and may contain anything
  the user typed. If this project is not a git repository yet and one gets initialized
  later (`git init`, cloning turns it into one, etc.), add `/session-log/` to `.gitignore`
  at that point, before anything is committed — don't wait to be asked.

### On-demand outputs

Trigger these from natural phrasing — don't wait for the exact command name:

- **Cost / spend / token usage asked about** → run `node _scripts/cost-report.mjs`, relay
  the output conversationally (lead with the dollar total, not the table).
- **"Make a recap" / "give me an overview" / "light story page"** → follow the
  **Recap generation flow** below.
- **"Milestone timeline" / "show me the milestones"** → follow the **Recap generation
  flow**, defaulting the section picker to just the Milestones section.
- **"What decisions did I make" / "decision log" / "why did I do X"** → run
  `node _scripts/decision-digest.mjs` (add `--days N` if they scoped it to a timeframe —
  "this week," "recently," etc.), relay conversationally.
- **"Change detail level" / "log lighter/deeper" / "log less/more"** → edit the
  `Detail tier:` line above to the requested tier (lite/standard/deep). Confirm briefly.
<!-- SHOWCASE-LOGGING-END -->
```

---

## The Folder README

Write this to `session-log/README.md` in Step 5 (it's for humans browsing the repo, not
for Claude — no markers, safe to overwrite on re-setup):

```markdown
# session-log/

This folder is an automatic, running log of the work done on this project with Claude
Code. Claude appends an entry here after every request — verbatim prompt, what changed,
key decisions, and token cost — and can turn that history into reports on demand. Setup
lives in the `showcase-log` skill; you don't maintain any of this by hand.

## What's in here

| File / folder | What it is |
|---|---|
| `session-log.md` | The live log — one entry per request, newest at the bottom. |
| `archive/` | Older entries rolled off `session-log.md` to keep it lean. |
| `usage/` | Exact token usage harvested from Claude Code transcripts (`usage.jsonl`) plus a readable `summary.md`. |
| `recap.html` | Generated overview page: daily activity bars, cost tables, milestones, decisions, and optional AI-analyzed sections (workstreams, patterns, recommendations). Open in a browser — works on mobile too. |

`recap.html` is regenerated from scratch each time — treat it as a disposable view, not
something to hand-edit.

## How to use it

Just ask Claude in plain language — no commands to memorize:

- **"What did this cost so far?"** → a cost breakdown by model and time window.
- **"Make a recap"** → asks which sections to include, generates `recap.html`, and optionally fills in AI analysis sections. Just want the milestones? Say so and it'll build a recap with only that section.
- **"What decisions did I make?" / "why did we do X?"** → a dated digest of logged decisions.
- **"Log lighter" / "log deeper"** → change how much detail each entry captures.
- **Declare a milestone** — say something like *"milestone: shipped the v1 API"* and Claude
  records it so it shows up in the recap.

## A note on the numbers

Costs shown are API-equivalent value at list prices, not necessarily what you were billed.
```

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
- `recap.html` is fully regenerated on every run (never hand-edited, never diffed/merged) — treat it as a disposable view over `session-log/`, not a second source of truth.

---

## Recap Generation Flow

The recap page (`session-log/recap.html`) has two layers — a **deterministic base** generated
by `generate-recap.mjs`, and **AI-analyzed sections** that Claude fills in afterwards. The
page is mobile-friendly, renders without JavaScript (charts pre-rendered as static HTML), and
uses JS only for interactive enhancements (tooltips, slide-out panel, hover line).

A sample recap is included at `assets/recap-sample-ci.html` as a reference for the final
output quality.

### Step 1: Section picker

When the user asks "make a recap" (or equivalent), ask via AskUserQuestion — header
"Recap sections", question "Which sections should the recap include?", multi-select:

1. **Daily activity** (deterministic) — cost bars per day, tap to see entries
2. **Cost & time** (deterministic) — cost by model and time window tables
3. **Milestones** (deterministic) — condensed milestone list
4. **Key decisions** (deterministic) — recent logged decisions
5. **Workstreams** (AI) — swimlane chart of classified activity threads
6. **Milestones & capabilities timeline** (AI) — dual timeline with milestones and capabilities
7. **How you use Claude** (AI) — patterns in how the user works with Claude
8. **Recommendations** (AI) — forward-looking suggestions

Default: all selected. The deterministic sections are always safe to include. The AI sections
require Claude to read the log and write analysis.

### Step 2: Generate the base

Run `node _scripts/generate-recap.mjs`. This creates `session-log/recap.html` with:
- All deterministic sections filled in (daily bars, cost tables, milestones, decisions)
- AI sections showing placeholder text ("This section is generated by Claude…")
- Pre-rendered static HTML for all charts (works in viewers that don't execute JS)
- Mobile-responsive CSS (breakpoints at 680px and 400px)
- Interactive JS for tooltips, side panel, and swimlane hover (progressive enhancement)

### Step 3: Fill AI sections (if selected)

For each AI section the user selected, read the log entries and write the content directly
into `recap.html`, replacing the placeholder `<div>`. Follow these patterns:

#### Workstreams

1. Read all log entries. Auto-classify each into workstreams by analyzing the heading and
   content. Each workstream gets a name, color, and description.
2. **First time generating for this project:** present the classified workstreams to the user
   and ask them to validate. "I classified your work into these N workstreams — does this
   look right? Any to rename, merge, or split?" Adjust based on feedback.
3. On subsequent generations, reuse the established workstream classification (store it as a
   comment in the recap or in a `.workstreams.json` file in `session-log/`).
4. Generate the workstreams section HTML:
   - Legend with color swatches
   - Swimlane rows with `.ws-row`, `.ws-label`, `.ws-track`, `.ws-bar` elements
   - Positioned bars computed from entry dates (left % and width % relative to project span)
   - Opacity scaled by activity density
   - Click zones as `<a>` links to day panels
   - Hover line elements
   - Description list with name, narrative, and cost per workstream

Colors to use: `#3b82f6`, `#10b981`, `#8b5cf6`, `#f59e0b`, `#ef4444`, `#6b7280` (extend
as needed for more workstreams).

#### Milestones & capabilities timeline

Generate a dual timeline using `.tl-row` structure:
- Left column: milestone cards (amber: `#fde68a`/`#fffbeb` border/bg)
- Center: date badges and connectors
- Right column: capability cards (purple: `#c4b5fd`/`#f5f3ff` border/bg)
- Use gap rows with dashed connectors for periods without events

#### How you use Claude (patterns)

Analyze the log for recurring patterns in how the user works with Claude. Each pattern gets
a `.pattern-block` with a colored `.pattern-tag` and a narrative paragraph. Tags:
- `.tag-dynamics` (purple): collaboration patterns
- `.tag-forward` (green): emerging practices
- `.tag-optimize` (pink): optimization opportunities

#### Recommendations

Write forward-looking suggestions based on what the log reveals. Group into blocks with
`.pattern-tag` labels. Include project direction and skill/automation candidates.

### Step 4: Remove unselected sections

For any section the user didn't select, remove the entire `<section>` element from the HTML
(find by `data-section` attribute). Don't leave empty sections.

### Step 5: Deliver

Tell the user where `session-log/recap.html` is and offer to open it.
