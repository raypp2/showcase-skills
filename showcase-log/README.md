# showcase-log

**Turn on a permanent, structured log of a Claude Code project before the raw material disappears.**

Claude Code deletes transcripts after roughly 30 days. Long sessions get compacted well
before that, summarizing away exact wording to save context. Either way, the thing that
actually shows how a project happened — the exact prompt that unlocked something, the
reasoning behind a decision, the pattern in how someone asks for things — is gone for good
once it does. `showcase-log` copies that raw material into the project itself, as plain
text, before it ages out, and turns it into a few things worth having on their own:

- 📖 **A recap page** — the main way to get a report back. A single HTML file built from
  a section picker: daily activity and cost are always available, plus optional AI-written
  analysis of how the project actually went — including a milestones & capabilities
  timeline. You choose which sections to include each time you ask for one.
- 💰 **A cost report** — spend by model, by session, by week, by all-time. On demand, in chat.

No dashboards to configure, no separate service to run. It's a `CLAUDE.md` instruction block plus a handful of scripts that read the log and write these outputs when asked.

## Getting started

```
/showcase-log
```

Run it once at the start of a project. Setup asks **no questions** — detail defaults to a
standard tier (verbatim prompts, what was built, what was decided, cost) and everything else
is automatic: the `CLAUDE.md` block, the folder, git hygiene, hooks. Change the detail level
any time by just saying so — "log lighter" or "log deeper" — no need to re-run setup.

The earlier it's on, the less is lost — but running it on a project that's already underway
isn't wasted either: setup mines whatever transcript history is still sitting in Claude
Code's local files and backfills entries from it before that history ages out too.

## What you get, day to day

Ask in plain language, no commands to remember:

| You ask | You get |
|---|---|
| "What did this cost so far?" | Cost by model and by time window (this session / 7d / 30d / all-time) |
| "Make a recap" | A section picker, then `session-log/YYYY-MM-DD-Recap.html` — open it in any browser |
| "Take out the dollar amounts" / "swap cost for hours" | A second file, `...-Recap-Shared.html`, with every dollar figure replaced by its time or percentage equivalent. Only built if you ask for the cost swap specifically — never inferred from a generic "make this shareable" |
| "What decisions did I make?" | Read straight from the log and answered in chat — no dedicated recap section |
| "Log lighter" / "log deeper" | Changes how much detail future entries capture |
| "Milestone: shipped the v1 API" | Recorded, and it shows up on the recap's AI-written milestones & capabilities timeline |

## What the recap shows

The recap is the main mechanism for delivering a report back — the cost report is really
just a scoped version of it. Every time you ask for one, you pick which sections to include,
and it's written to a file dated to that day (`YYYY-MM-DD-Recap.html`) rather than
overwriting a single fixed file — recaps from different days accumulate side by side in
`session-log/`; asking again later the same day overwrites that day's file.

| Section | Kind | What it shows |
|---|---|---|
| Daily activity | Deterministic | Cost bars per day — tap one to see that day's entries |
| Cost & time | Deterministic | Cost by model, and by time window (session / 7d / 30d / all-time) |
| Workstreams | AI-written | Gantt-style overview of activity threads Claude classifies from the log, plus an accordion detail list |
| Milestones & capabilities timeline | AI-written | A dual timeline pairing declared milestones with capabilities shipped |
| How you use Claude | AI-written | Patterns Claude notices in how you prompt and collaborate |
| Findings, ranked by value | AI-written | Ranked, actionable findings — project direction and how you could work with Claude better — closed by a "three things this week" capstone |

The two deterministic sections are always safe and instant — they're just read off the log
and usage snapshot. The four AI-written ones ask Claude to actually read the log and draft
analysis, so they take a bit longer. All six are optional; say what you want ("just the
milestones timeline," "everything," "skip the AI stuff") and that's what gets built. There's
no standalone milestones list or key-decisions view — milestones surface through the AI
timeline, and decisions stay in the log itself, answered conversationally when you ask.

## How it works

Everything lives in one folder in the project, `session-log/`:

```
session-log/
  README.md         plain-English guide, generated for anyone browsing the repo
  session-log.md     live entries — the log itself
  archive/*.md         older entries, rolled off automatically to keep the live file lean
  usage/usage.jsonl     exact token usage harvested from Claude Code transcripts
  usage/summary.md       human-readable cost rollup
  YYYY-MM-DD-Recap.html  generated on demand — daily activity, cost, plus optional AI sections;
                           one per day recapped, not overwritten by later days
```

A `CLAUDE.md` block tells Claude to append a structured entry after every request —
verbatim prompt, what changed, key decisions, cost — and how to trigger the outputs above.
That's an instruction, though, not a guarantee, so three things run on `SessionStart`/`Stop`
hooks instead of trusting it alone: token costs are harvested before Claude Code's own
transcript cleanup would erase them, old entries get archived automatically once the live
file grows past ~40, and a coverage check compares real transcript prompts against what
actually landed in the log — flagging anything that was silently never logged, while it's
still recoverable. All three debounce to about once a day, so the per-turn cost stays
negligible.

`session-log/` is gitignored by default. Prompts are verbatim, so they can carry anything
someone typed — sharing that history is something you opt into, never the default. If the
project isn't a git repo yet, the same rule is carried in the `CLAUDE.md` block itself, so
`/session-log/` still gets ignored automatically the moment git shows up later.

## Part of the showcase family

`showcase-log` is the always-on data layer. `showcase-project` (a separate skill, not
included in this repo) is the presentation layer built on top of it — an interview-driven
skill that turns the log into a curated, shareable story page. Run `showcase-log` from day
one and `showcase-project` has real verbatim prompts and a real timeline to draw from later,
instead of reconstructing the project from memory and file timestamps.

## Reference docs

- [`SKILL.md`](SKILL.md) — the operating instructions Claude follows (setup steps, entry
  format, on-demand output triggers)
- [`RECAP.md`](RECAP.md) — the full recap-generation flow (section picker, base
  generation, AI-authored sections) — split out from SKILL.md since it's substantial and
  only read on demand, not every session
- [`BACKFILL.md`](BACKFILL.md) — how setup reconstructs entries from an existing project's
  transcript history
- [`MIGRATION.md`](MIGRATION.md) — upgrading a project set up with the pre-2.1 flat file
  layout (`session-log.md` at the project root instead of the unified folder)

## What's in this folder

```
showcase-log/
├─ SKILL.md                    source of truth — name + version in frontmatter
├─ README.md                   this file
├─ RECAP.md                    reference: full recap-generation flow (on-demand, not loaded every session)
├─ BACKFILL.md                 reference: reconstructing history on an existing project
├─ MIGRATION.md                reference: upgrading from the pre-2.1 layout
├─ scripts/
│  ├─ archive-session-log.mjs
│  ├─ usage-snapshot.mjs
│  ├─ check-log-coverage.mjs
│  ├─ cost-report.mjs
│  ├─ generate-recap.mjs
│  ├─ backfill-from-history.mjs
│  └─ lib/                     shared path/parsing/usage/transcript helpers
├─ assets/
│  └─ recap-template.html      HTML shell generate-recap.mjs fills in
├─ tests/                      smoke tests (dev-only — never copied into a project)
└─ _dist/                      built distributable (see the repo root README)
```

## Running the tests

```bash
node --test tests/*.test.mjs
```

Dev-only — `tests/` lives outside `scripts/`, so Step 7's install (`scripts/*.mjs →
_scripts/*.mjs`) never ships it into a consumer project. Uses Node's built-in test runner,
no dependencies to install.

A costs note, since it comes up: figures shown anywhere in this skill's output are
**API-equivalent value at list prices** — what the usage would cost at API rates — not necessarily what a subscription plan was actually billed.

And an honest overhead note: logging isn't free. Every request now costs one extra `date`
tool call, a roughly 100–600 token log write depending on detail tier, and the logging
instructions themselves take up space in every session's context. It's a real trade — small
per request, but not zero — made in exchange for not losing the history at all.
