# Migrating from showcase-log v1

**Most users can ignore this file.** v1 had low distribution, so a fresh
`/showcase-log` setup on a new project needs none of the steps below. This is only
relevant when upgrading a project that was set up with the pre-2.1 flat layout.

## What changed in 2.1

v1 scattered its files across the project root:

```
session-log.md            → session-log/session-log.md
session-log-archive/      → session-log/archive/
session-usage/            → session-log/usage/
```

2.1 consolidates everything under a single `session-log/` folder, so there is exactly
one thing to gitignore and one place to point people at.

## Migration steps

Run these **before** anything else in setup (i.e. before the SKILL.md steps), so the
rest of setup sees the new layout. Skip entirely if `session-log/` already exists in the
new layout, or if none of the legacy paths exist (brand-new project).

```bash
mkdir -p session-log
[ -f session-log.md ] && git mv session-log.md session-log/session-log.md 2>/dev/null || mv session-log.md session-log/session-log.md
[ -d session-log-archive ] && mv session-log-archive session-log/archive
[ -d session-usage ] && mv session-usage session-log/usage
```

(Use plain `mv`/`mkdir` if the folder isn't a git repo.)

## After moving the files

Setup's normal steps handle the rest, but be aware of two follow-ups they cover:

- **Git hygiene** — `.gitignore` should now contain `/session-log/`; remove any leftover
  `/session-log.md`, `/session-log-archive/`, `/session-usage/` lines. Untrack anything
  already committed under the old paths (a gitignore rule doesn't untrack existing files):
  ```bash
  git rm -r -q --cached session-log.md session-log-archive session-usage 2>/dev/null || true
  ```
  If this untracks anything, it will show as a deletion in the next commit.
- **Entry format** — v1 numbered entries (`### #12 — ...`) and v2 dated entries coexist in
  the same `session-log.md`; the archiver understands both, so there is nothing that
  *needs* rewriting for the layout migration itself. But v1 entries carry no date, and
  every deterministic recap feature keyed on date (daily activity chart, day drill-downs,
  the workstreams gantt) renders empty for them until they get one — that's what Step 4's
  case B (see `SKILL.md`) and `scripts/enrich-log-dates.mjs` are for, and setup runs that
  check automatically right after this migration, not as a separate ask.

Once the files are moved, tell the user their old log layout was migrated into
`session-log/` and continue with normal setup.
