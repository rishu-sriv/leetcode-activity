# LeetCode → GitHub contribution sync

Date: 2026-11-25
LeetCode: leetcode.com/u/rishu_codes · GitHub: github.com/rishu-sriv (id 180553705)

## Intent / why

Rishu wants the GitHub contribution graph on `rishu-sriv` to go green off the
back of LeetCode practice. Solving a problem is the real work; it should show up
as activity on the profile without a second ritual. Stated constraints, verbatim
in spirit: nothing to install anywhere, works day or night unattended, the
solution source code itself does not matter.

## Goals

- Every accepted LeetCode submission eventually becomes one commit, authored by
  Rishu, on the default branch of a repo Rishu owns — so it counts on the graph.
- Fully unattended. No extension, no local script, no laptop powered on.
- Zero ongoing cost and no credentials that expire.

## Non-goals

- Storing or archiving solution code (explicitly not wanted; also needs an
  expiring `LEETCODE_SESSION` cookie, which breaks "no maintenance").
- Backfilling practice history. LeetCode's public API only exposes the last 20
  accepted submissions, so the existing 36 solves cannot be fully recovered.
- Commit-for-commit realism. One commit per accepted submission, nothing fancier.

## Anti-goals

- Anything that fakes activity when no problem was solved. The graph should
  reflect real accepted submissions, nothing else.
- Anything requiring a monthly re-auth or re-install.

## Constraints (verified, not assumed)

- `recentAcSubmissionList` on LeetCode's public GraphQL endpoint returns the last
  accepted submissions (id, title, slug, language, unix timestamp) with **no
  authentication**. Confirmed working against `rishu_codes` today.
- GitHub counts a commit as a contribution when: the repo is not a fork, the
  commit is on the default branch, and the **commit author email** is linked to
  the account. Who pushes it is irrelevant — so the workflow's built-in
  `GITHUB_TOKEN` is enough, as long as the author is set to
  `180553705+rishu-sriv@users.noreply.github.com`.
- `schedule:` cron is best-effort. A `*/5` schedule realistically fires every
  5–20 minutes, and GitHub may skip ticks under load. "The moment it's accepted"
  is not achievable; **within roughly 20 minutes, around the clock** is.
- Actions minutes are unlimited on **public** repos. At this polling frequency
  the repo must be public, which is fine for a solved-log.
- GitHub disables scheduled workflows after 60 days of repo inactivity. The
  workflow's own commits count as activity, so it self-sustains while Rishu
  keeps solving; a 60-day gap needs one click to re-enable.
- The graph buckets by the commit's author date including timezone. Commits will
  be stamped with the real submission time in IST so squares land on the
  correct day.

## Approaches considered

1. **Browser extension (LeetHub 3.0 / LeetSync).** Pushes the solution file the
   instant you hit Accept — genuinely real-time. Rejected: requires installing
   something, only works in that one browser, dead for mobile solving, and
   breaks whenever LeetCode changes its page.
2. **Local cron / launchd script.** Simple, but only runs when the Mac is awake.
   Rejected against "day or night, nothing on my machine".
3. **Scheduled GitHub Action polling the public API. ← chosen.** Runs on
   GitHub's infrastructure, no install, no expiring secret, works no matter what
   device the problem was solved on. Trade-off accepted by the goals: up to ~20
   minutes of lag instead of instant.

## The how, as decided

- New **public** repo `rishu-sriv/leetcode-activity`, default branch `main`.
- `.github/workflows/sync.yml`: `schedule: */5 * * * *` plus
  `workflow_dispatch` for manual runs.
- A single script the workflow runs:
  1. POST the `recentAcSubmissionList` query for `rishu_codes`.
  2. Read `submissions.json` in the repo — the ledger of submission ids already
     committed. This is what makes the job idempotent and prevents double
     commits across overlapping or retried runs.
  3. For each new id, oldest first: append a row to `README.md`
     (date, problem, difficulty-less title, language, link), add the id to the
     ledger, and `git commit` with author
     `rishu-sriv <180553705+rishu-sriv@users.noreply.github.com>` and both
     `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` set to the submission's real
     timestamp in `+05:30`.
  4. Push. Nothing to push on a quiet tick is a clean no-op, not a failure.
- First run commits whatever the API currently returns (the 20 most recent),
  which seeds the ledger and lights up the recent part of the graph.
- Pushes use the workflow's own `GITHUB_TOKEN`; no personal access token, no
  secret to rotate.

## Left to the builder

- Exact README table formatting and commit message wording.
- Whether the ledger lives as a JSON array or newline-delimited ids.
- Retry/timeout handling on the GraphQL call (a failed tick should exit 0-ish
  and let the next tick catch up rather than spamming failure email).

## One-time manual step for Rishu

Creating the repo and letting it push: either install `gh` and authenticate, or
create the empty public repo in the browser and paste the push URL. No GitHub
CLI is installed on this machine today.
