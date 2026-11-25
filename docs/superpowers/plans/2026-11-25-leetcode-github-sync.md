# LeetCode → GitHub Contribution Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public GitHub repo whose scheduled Action polls LeetCode's public API every 5 minutes and turns each newly accepted submission into one commit authored by `rishu-sriv`, so the contribution graph greens unattended.

**Architecture:** Pure functions in `scripts/lib.mjs` (diff against ledger, render rows, format IST commit dates) are unit-tested with `node --test`; `scripts/sync.mjs` is the thin impure shell that fetches, calls the pure functions, and shells out to `git`. A committed ledger file `data/seen.json` makes the job idempotent across overlapping, retried, or replayed cron ticks.

**Tech Stack:** Node 22 (built-in `fetch`, `node:test`) — zero npm dependencies, so nothing to install and nothing to keep up to date. GitHub Actions `schedule` cron. Git CLI.

**Spec:** `docs/superpowers/specs/2026-11-25-leetcode-github-sync-design.md`

## Global Constraints

- LeetCode username: `rishu_codes`. GitHub: `rishu-sriv`, numeric id `180553705`.
- Commit author, exactly: `rishu-sriv <180553705+rishu-sriv@users.noreply.github.com>`. The graph only counts commits whose **author email** is linked to the account.
- Both `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` are set to the submission's real time in `+05:30` (IST).
- Repo must be **public** (free unlimited Actions minutes at this poll rate) and `main` must be the default branch; contributions never count on a fork or off the default branch.
- Zero npm dependencies. No `LEETCODE_SESSION` or any secret that expires — auth is the workflow's built-in `GITHUB_TOKEN` only.
- Solution source code is explicitly out of scope. Only a log of what was solved.
- A tick that finds nothing new, or cannot reach LeetCode, must exit 0. Never fail a run on a quiet night.

## Review Focus

1. **LeetCode returns an error, empty body, or HTML (rate limit / outage).** The run must exit 0 having committed nothing, not crash and not wipe the ledger. — Task 2
2. **An id already in the ledger reappears in the API window** (it always will; the window is the last 20). It must never produce a second commit. — Task 1
3. **The same problem solved twice** has two distinct submission ids and must produce two commits — dedupe is by id, never by title. — Task 1
4. **A problem title containing `|`** must not break the README table row. — Task 1
5. **A submission just before IST midnight** must land on its own day's square, not the next one — the `+05:30` offset must be in the stamped date, not applied by shifting the clock. — Task 1

---

### Task 1: Pure sync logic

**Files:**
- Create: `scripts/lib.mjs`
- Test: `test/lib.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `newSubmissions(apiList: Array<{id,title,titleSlug,timestamp,lang}>, seenIds: string[]) -> Array<sub>` — entries whose `String(id)` is not in `seenIds`, sorted ascending by numeric `timestamp` (oldest first).
  - `istCommitDate(timestamp: string|number) -> string` — e.g. `"2026-11-25 20:19:24 +0530"`, the unix timestamp rendered in IST with a literal `+0530` offset.
  - `readmeRow(sub) -> string` — `| YYYY-MM-DD HH:MM IST | [Title](https://leetcode.com/problems/<slug>/) | <lang> |`, with `|` in the title escaped as `\|`.
  - `insertRows(readmeText: string, rows: string[]) -> string` — inserts rows directly beneath the line `<!-- log -->` so newest ends up on top; throws `Error("README marker <!-- log --> not found")` if the marker is absent.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newSubmissions, istCommitDate, readmeRow, insertRows } from '../scripts/lib.mjs'

const sub = (id, timestamp, title = 'Two Sum', titleSlug = 'two-sum', lang = 'cpp') =>
  ({ id, title, titleSlug, timestamp, lang })

test('skips ids already in the ledger', () => {
  const out = newSubmissions([sub('2', '1700000100'), sub('1', '1700000000')], ['1'])
  assert.deepEqual(out.map(s => s.id), ['2'])
})

test('returns oldest first so commits land in chronological order', () => {
  const out = newSubmissions([sub('3', '1700000200'), sub('1', '1700000000'), sub('2', '1700000100')], [])
  assert.deepEqual(out.map(s => s.id), ['1', '2', '3'])
})

test('two submissions of the same problem both count', () => {
  const out = newSubmissions([sub('9', '1700000100'), sub('8', '1700000000')], [])
  assert.equal(out.length, 2)
})

test('empty api list yields nothing', () => {
  assert.deepEqual(newSubmissions([], ['1']), [])
})

test('stamps the date in IST with a literal +0530 offset', () => {
  // 1795625964 = 2026-11-25 20:19:24 IST
  assert.equal(istCommitDate('1795625964'), '2026-11-25 20:19:24 +0530')
})

test('a submission just before IST midnight keeps its own day', () => {
  // 1795631340 = 2026-11-25 21:49:00 IST ; 1795639200 = 2026-11-26 00:00:00 IST
  assert.match(istCommitDate('1795631340'), /^2026-11-25 /)
  assert.match(istCommitDate('1795639200'), /^2026-11-26 00:00:00 /)
})

test('escapes a pipe in the problem title', () => {
  const row = readmeRow(sub('1', '1795625964', 'A | B', 'a-b', 'python3'))
  assert.ok(row.includes('A \\| B'))
  assert.equal(row.split('|').length - 1, 5) // 4 cell delimiters + the escaped one
})

test('row links the problem and names the language', () => {
  const row = readmeRow(sub('1', '1795625964', 'Single Number', 'single-number', 'cpp'))
  assert.ok(row.includes('https://leetcode.com/problems/single-number/'))
  assert.ok(row.includes('cpp'))
  assert.ok(row.includes('2026-11-25'))
})

test('inserts rows under the marker, newest on top', () => {
  const out = insertRows('# T\n<!-- log -->\n| old |\n', ['| a |', '| b |'])
  assert.match(out, /<!-- log -->\n\| a \|\n\| b \|\n\| old \|/)
})

test('throws when the marker is missing', () => {
  assert.throws(() => insertRows('# T\nno marker\n', ['| a |']), /marker/)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/rishu/leetcode-activity && node --test test/`
Expected: FAIL — cannot resolve `../scripts/lib.mjs`

- [ ] **Step 3: Implement the four exports in `scripts/lib.mjs`**

For `istCommitDate`, add `5.5 * 3600` seconds to the unix timestamp, format the result with `toISOString()` UTC getters, and append the literal `+0530` — do not use `toLocaleString`, whose output format is not stable across runners.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/rishu/leetcode-activity && node --test test/`
Expected: PASS, 10 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib.mjs test/lib.test.mjs
git commit -m "feat: pure logic for diffing leetcode submissions against the ledger"
```

---

### Task 2: Fetch-and-commit shell

**Files:**
- Create: `scripts/sync.mjs`
- Create: `data/seen.json` (content: `[]`)
- Create: `README.md` (title, one line of explanation, table header, then the `<!-- log -->` marker)
- Test: `test/fetch.test.mjs`

**Interfaces:**
- Consumes: all four exports from Task 1's `scripts/lib.mjs`.
- Produces:
  - `fetchRecentAc(username: string, fetchImpl = fetch) -> Promise<Array<sub>>` — exported from `scripts/sync.mjs`; resolves to `[]` on any non-200, malformed JSON, GraphQL `errors`, or missing `data.recentAcSubmissionList`. Never throws.
  - A `main()` that runs only when the module is the entry point, so the test can import `fetchRecentAc` without triggering git.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchRecentAc } from '../scripts/sync.mjs'

const ok = body => async () => ({ ok: true, status: 200, json: async () => body })

test('parses the submission list', async () => {
  const out = await fetchRecentAc('rishu_codes', ok({ data: { recentAcSubmissionList: [{ id: '1', title: 'T', titleSlug: 't', timestamp: '1795625964', lang: 'cpp' }] } }))
  assert.equal(out.length, 1)
  assert.equal(out[0].titleSlug, 't')
})

test('returns empty on a rate-limit response', async () => {
  assert.deepEqual(await fetchRecentAc('u', async () => ({ ok: false, status: 429, json: async () => ({}) })), [])
})

test('returns empty when the body is HTML, not JSON', async () => {
  assert.deepEqual(await fetchRecentAc('u', async () => ({ ok: true, status: 200, json: async () => { throw new Error('invalid json') } })), [])
})

test('returns empty on a graphql error payload', async () => {
  assert.deepEqual(await fetchRecentAc('u', ok({ errors: [{ message: 'nope' }] })), [])
})

test('returns empty when the network throws', async () => {
  assert.deepEqual(await fetchRecentAc('u', async () => { throw new Error('ENOTFOUND') }), [])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/rishu/leetcode-activity && node --test test/fetch.test.mjs`
Expected: FAIL — cannot resolve `../scripts/sync.mjs`

- [ ] **Step 3: Implement `scripts/sync.mjs`**

`fetchRecentAc` POSTs to `https://leetcode.com/graphql` with `Content-Type: application/json` and a `Referer` of the user's profile URL, body:

```js
{ query: `query($u:String!,$n:Int!){recentAcSubmissionList(username:$u,limit:$n){id title titleSlug timestamp lang}}`,
  variables: { u: username, n: 20 } }
```

`main()` then: read `data/seen.json` (treat a missing or unparseable file as `[]`); `newSubmissions(list, seen)`; if empty, log `"nothing new"` and return. Otherwise, for each submission oldest-first: `insertRows` one `readmeRow` into `README.md`, push the id onto the ledger, write both files, and commit that one submission with `execFileSync('git', ...)` — author `rishu-sriv <180553705+rishu-sriv@users.noreply.github.com>`, `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` both `istCommitDate(sub.timestamp)`, message `solved: <title> (<lang>)`. One commit per submission, so each gets its own correctly-dated square.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/rishu/leetcode-activity && node --test test/`
Expected: PASS, 15 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/sync.mjs data/seen.json README.md test/fetch.test.mjs
git commit -m "feat: fetch accepted submissions and commit one square each"
```

---

### Task 3: Workflow, repo, and live verification

**Files:**
- Create: `.github/workflows/sync.yml`
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Write `.github/workflows/test.yml`**

On `push` and `pull_request`: `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 22`, then `node --test test/`.

- [ ] **Step 2: Write `.github/workflows/sync.yml`**

```yaml
on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:
concurrency:
  group: sync
  cancel-in-progress: false
permissions:
  contents: write
```

Single job on `ubuntu-latest`: checkout, `setup-node@v4` (node 22), `node scripts/sync.mjs`, then `git push`. `concurrency` serializes overlapping ticks so two runs cannot race the ledger. Before pushing, `git pull --rebase` so a push that lost a race retries cleanly instead of failing the run.

- [ ] **Step 3: Grant the `workflow` scope, then create the public repo**

Run: `gh auth refresh -h github.com -s workflow` (interactive device code; a `repo`-only token cannot push files under `.github/workflows/`)
Run: `gh repo create leetcode-activity --public --source=. --remote=origin --push`
Expected: repo exists at `https://github.com/rishu-sriv/leetcode-activity` with `main` as default branch.

- [ ] **Step 4: Verify the test workflow is green**

Run: `gh run list --workflow=test.yml` then `gh run watch`
Expected: `test.yml` conclusion `success`.

- [ ] **Step 5: Trigger the sync manually and verify real commits land**

Run: `gh workflow run sync.yml` then `gh run watch`
Run: `git pull && git log --pretty='%an <%ae> %ad %s' --date=iso -5`
Expected: one commit per recent accepted submission, every author line `rishu-sriv <180553705+rishu-sriv@users.noreply.github.com>`, dates carrying `+0530`, messages naming real problems from the profile.

- [ ] **Step 6: Verify idempotency — the core guarantee**

Run: `gh workflow run sync.yml` then `gh run watch`, then `git pull && git log --oneline | wc -l`
Expected: commit count unchanged from Step 5; the run's log says `nothing new`.

- [ ] **Step 7: Verify the contributions graph actually counted them**

Run: `gh api graphql -f query='{viewer{contributionsCollection{contributionCalendar{totalContributions}}}}'`
Expected: `totalContributions` includes today's commits. If it reads 0 for commits that exist, the author email is not linked to the account — fix the email, do not proceed.

- [ ] **Step 8: Commit and push any fixes from the live run**

```bash
git add -A && git commit -m "chore: sync workflow" && git push
```

---

### Task 4: Hand-off note

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the two things that can ever need a human**

Add a short "How this works" section: the cron is best-effort so a square appears within roughly 20 minutes, not instantly; and GitHub disables scheduled workflows after 60 days of repo inactivity, which only happens after a 60-day gap in solving and takes one click in the Actions tab to re-enable.

- [ ] **Step 2: Commit and push**

```bash
git add README.md && git commit -m "docs: how the sync works and when it needs a human" && git push
```
