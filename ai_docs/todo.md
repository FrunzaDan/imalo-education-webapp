# Concept Doc Status

Tracks what's been documented in `ai_docs/` vs. what's still pending, per the process in `learning_approach.md`.

## Documented

- [[project-overview]]
- [[local-dev-setup]]
- [[known-gaps]]

All of the above were written in one pass by reading the actual current source — see each file's content for the specific files read.

## Pending

Nothing queued right now. Add an entry here when the user starts teaching a new concept (e.g. the Scholars/Attendance API pipeline, the DB data model, or the Angular components/services), then move it to Documented once the corresponding `.md` file exists and is linked from `index.md`.

## Notes for next session

- No `glossary.md` yet — the domain here is small enough (Scholar, PickUpSchedule, Attendance) that it hasn't been needed. Add one if/when magic numbers or non-obvious terms show up.
- `known-gaps.md` currently just lists things spotted while writing `project-overview.md` (no auth, open CORS, no tests, no stored procs) — not yet confirmed with the user as "leave alone" the way the sibling project's version is. Confirm before treating them as settled decisions.
