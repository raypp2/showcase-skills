<!-- SHOWCASE-LOGGING-START -->
## Project Log

**Maintain a running log in `session-log/session-log.md`.** After completing each user
request (not during — finish the work first, then log), silently append an entry. Do not
ask permission. Do not mention you are logging.

**Detail tier: {{DETAIL_TIER}}** <!-- lite | standard | deep — set by /showcase-log -->

Run `date "+%Y-%m-%d %H:%M"` when you begin work on a request so the entry records real
start and end times. Never estimate times from memory, and never number entries.

### Entry Format

Heading: `### YYYY-MM-DD HH:MM–HH:MM — Short description`

Fields by tier — lite: Prompt, Context, Outcome, Model. standard: + Actions, Key Decisions,
Errors & Resolution. deep: + Sources, Approach, Verification. Omit any field with
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
- Archiving now happens automatically via hooks (rolls old entries into
  `session-log/archive/` once the live log passes ~40, refreshes the usage snapshot). The
  hook debounces daily, so on an unusually heavy day you can still run
  `node _scripts/archive-session-log.mjs` yourself if the live file is visibly getting long
  — it's a same-day backstop, not something you need to track normally.
- **`session-log/` is private by default** — prompts are verbatim and may contain anything
  the user typed. If this project is not a git repository yet and one gets initialized
  later (`git init`, cloning turns it into one, etc.), add `/session-log/` to `.gitignore`
  at that point, before anything is committed — don't wait to be asked.

### On-demand outputs

Trigger these from natural phrasing — don't wait for the exact command name:

- **Cost / spend / token usage asked about** → run `node _scripts/usage-snapshot.mjs` (no
  `--auto` — this is the one time a fresh harvest matters more than the 24h debounce, so
  today's spend isn't reported stale), then `node _scripts/cost-report.mjs`, relay the
  output conversationally (lead with the dollar total, not the table).
- **"Make a recap" / "give me an overview"** → follow [RECAP.md](RECAP.md), which ends by
  mentioning that dollar figures can be swapped out if wanted — never build that variant
  unless asked.
- **"Milestone timeline" / "show me the milestones"** → follow [RECAP.md](RECAP.md),
  defaulting the section picker to just the Milestones & capabilities timeline section.
- **"Take out the dollar amounts" / "swap cost for hours" / "I don't want to show what this
  cost"** → follow RECAP.md's "Cost-redacted version" section against that day's already-
  generated private recap. This is specifically about removing the dollar figures — don't
  infer it from a generic "make this shareable" or "something I can send someone" ask, which
  could mean all kinds of things (trimming prompts, dropping findings, nothing at all) that
  have nothing to do with cost.
- **"What decisions did I make" / "decision log" / "why did I do X"** → there's no
  dedicated recap section for this — read `session-log/session-log.md` (and `archive/` if
  needed) directly for entries with a Key Decisions field and relay them conversationally.
- **"Change detail level" / "log lighter/deeper" / "log less/more"** → edit the
  `Detail tier:` line above to the requested tier (lite/standard/deep). Confirm briefly.
- **"Did we miss anything" / "check the log for gaps" / "is the log complete"** → run
  `node _scripts/check-log-coverage.mjs --report`, relay what it found. If it flags real
  gaps, offer to draft entries for them now (same format as any other logged request) —
  don't wait for a second ask.
- **"Backfill dates" / "add dates to my log" / "enrich the log with dates"** (also the
  natural next step if a recap's Daily Activity says entries lack dates) → run
  `node _scripts/enrich-log-dates.mjs`, relay what it did: how many entries got a date, how
  many were interpolated from neighbors, and whether any are still undated because
  transcript history has aged out.
- **If a Stop/SessionStart hook's output mentions a coverage gap** (the `⚠
  check-log-coverage:` line, or `session-log/coverage.md` exists), mention it to the user
  once, briefly, at a natural point — don't wait for them to ask. This is the one hook
  output worth surfacing unprompted; the usage/archive hooks are silent on purpose.
<!-- SHOWCASE-LOGGING-END -->
