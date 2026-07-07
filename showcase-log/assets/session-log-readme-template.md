# session-log/

This folder is an automatic, running log of the work done on this project with Claude
Code. Claude appends an entry here after every request — verbatim prompt, what changed,
key decisions, and token cost — and can turn that history into reports on demand. Setup
lives in the `showcase-log` skill; you don't maintain any of this by hand.

> [!IMPORTANT]
> Nothing here leaves this machine automatically. Every script is local file I/O only —
> no network calls, no telemetry. Sharing a recap with anyone is something you choose to
> do yourself, never something the skill does on its own.

## What's in here

| File / folder | What it is |
|---|---|
| `session-log.md` | The live log — one entry per request, newest at the bottom. |
| `archive/` | Older entries rolled off `session-log.md` to keep it lean. |
| `usage/` | Exact token usage harvested from Claude Code transcripts (`usage.jsonl`) plus a readable `summary.md`. |
| `YYYY-MM-DD-Recap.html` | Generated overview page — the main report back to you. Open in a browser (works on mobile too). One file per day you ask for a recap; asking again later the same day overwrites that day's file. |

Each dated recap file is regenerated from scratch when you ask for one — treat it as a
disposable snapshot, not something to hand-edit. Older recaps stay put once a new day's
file is written; nothing deletes them automatically.

## How to use it

Just ask Claude in plain language — no commands to memorize:

- **"What did this cost so far?"** → a cost breakdown by model and time window.
- **"Make a recap"** → a quick scope question (complete report / deterministic only /
  choose sections — the first is the recommended one-click option), then generates today's
  `YYYY-MM-DD-Recap.html`.
- **"What decisions did I make?" / "why did we do X?"** → read `session-log/session-log.md`
  (and `archive/`) directly and answer conversationally — there's no dedicated recap
  section for this.
- **"Log lighter" / "log deeper"** → change how much detail each entry captures.
- **"Backfill dates"** → entries from a pre-2.1 log that migrated in without dates get real
  ones, matched from transcript history.
- **Declare a milestone** — say something like *"milestone: shipped the v1 API"* and Claude
  records it so it shows up in the recap.

## A note on the numbers

Costs shown are API-equivalent value at list prices, not necessarily what you were billed.
