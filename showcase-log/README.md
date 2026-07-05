# showcase-log

**Turn on a permanent, structured log of a Claude Code project before the raw material disappears.**

Claude Code deletes transcripts after roughly 30 days. Long sessions get compacted well
before that, summarizing away exact wording to save context. Either way, the thing that
actually shows how a project happened — the exact prompt that unlocked something, the
reasoning behind a decision, the pattern in how someone asks for things — is gone for good
once it does. `showcase-log` copies that raw material into the project itself, as plain
text, before it ages out, and turns it into a few things worth having on their own:

- 💰 **A cost report** — spend by model, by session, by week, by all-time. On demand, in chat.
- 📚 **A decision digest** — every non-obvious call that got made, dated, in one place.
- 📖 **A recap page** — a single mobile-friendly HTML file with daily activity, cost, milestones,
  and decisions, plus optional AI-written analysis of how the project actually went.

No dashboards to configure, no separate service to run. It's a `CLAUDE.md` instruction block
plus a handful of scripts that read the log and write these outputs when asked.

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
| "Make a recap" | A section picker, then `session-log/recap.html` — open it in any browser |
| "What decisions did I make?" | A dated digest of every logged decision |
| "Log lighter" / "log deeper" | Changes how much detail future entries capture |
| "Milestone: shipped the v1 API" | Recorded, and it shows up on the recap's timeline |

## How it works

Everything lives in one folder in the project, `session-log/`:

```
session-log/
  README.md         plain-English guide, generated for anyone browsing the repo
  session-log.md     live entries — the log itself
  archive/*.md         older entries, rolled off automatically to keep the live file lean
  usage/usage.jsonl     exact token usage harvested from Claude Code transcripts
  usage/summary.md       human-readable cost rollup
  recap.html           generated on demand — daily activity, cost, milestones, decisions
```

A `CLAUDE.md` block tells Claude to append a structured entry after every request —
verbatim prompt, what changed, key decisions, cost — and how to trigger the outputs above.
Two hooks (`SessionStart`, `Stop`) run a usage-harvesting script deterministically, so exact
token costs are captured before Claude Code's own transcript cleanup would otherwise erase
them — this one part doesn't depend on Claude remembering to do it.

`session-log/` is gitignored by default. Prompts are verbatim, so they can carry anything
someone typed — sharing that history is something you opt into, never the default. If the
project isn't a git repo yet, the same rule is carried in the `CLAUDE.md` block itself, so
`/session-log/` still gets ignored automatically the moment git shows up later.

## Part of the showcase family

`showcase-log` is the always-on data layer. [`showcase-project`](../showcase-project/) is
the presentation layer built on top of it — an interview-driven skill that turns the log
into a curated, shareable story page. Run `showcase-log` from day one and `showcase-project`
has real verbatim prompts and a real timeline to draw from later, instead of reconstructing
the project from memory and file timestamps.

## Reference docs

- [`SKILL.md`](SKILL.md) — the operating instructions Claude follows (setup steps, entry
  format, on-demand output triggers)
- [`BACKFILL.md`](BACKFILL.md) — how setup reconstructs entries from an existing project's
  transcript history
- [`MIGRATION.md`](MIGRATION.md) — upgrading a project set up with the pre-2.1 flat file
  layout (`session-log.md` at the project root instead of the unified folder)

## What's in this folder

```
showcase-log/
├─ SKILL.md                    source of truth — name + version in frontmatter
├─ README.md                   this file
├─ BACKFILL.md                 reference: reconstructing history on an existing project
├─ MIGRATION.md                reference: upgrading from the pre-2.1 layout
├─ scripts/
│  ├─ archive-session-log.mjs
│  ├─ usage-snapshot.mjs
│  ├─ cost-report.mjs
│  ├─ decision-digest.mjs
│  ├─ generate-recap.mjs
│  ├─ backfill-from-history.mjs
│  └─ lib/                     shared path/parsing/usage helpers
├─ assets/
│  ├─ recap-template.html      HTML shell generate-recap.mjs fills in
│  └─ recap-sample-ci.html     a complete reference recap, all sections filled
└─ _dist/                      built distributable (see the repo root README)
```

A costs note, since it comes up: figures shown anywhere in this skill's output are
**API-equivalent value at list prices** — what the usage would cost at API rates — not
necessarily what a subscription plan was actually billed.
