// Pure logic for the LeetCode -> GitHub contribution sync.
// Nothing here touches the network, the filesystem, or git, so it is all
// directly testable; scripts/sync.mjs is the impure shell around it.

const IST_OFFSET_SECONDS = 5.5 * 3600
export const LOG_MARKER = '<!-- log -->'

// Accepted submissions the ledger has not recorded yet, oldest first so the
// commits we build from them land in chronological order.
export function newSubmissions(apiList, seenIds) {
  const seen = new Set(seenIds.map(String))
  return apiList
    .filter(sub => !seen.has(String(sub.id)))
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
}

// The submission's wall-clock time in IST, in git's date format. Shifting the
// epoch and reading it back with the UTC getters keeps the output byte-stable
// across runners, which toLocaleString does not promise.
export function istCommitDate(timestamp) {
  const shifted = new Date((Number(timestamp) + IST_OFFSET_SECONDS) * 1000)
  return `${shifted.toISOString().replace('T', ' ').slice(0, 19)} +0530`
}

// One row of the README log table.
export function readmeRow(sub) {
  const when = istCommitDate(sub.timestamp).slice(0, 16)
  const title = String(sub.title).replaceAll('|', '\\|')
  const link = `[${title}](https://leetcode.com/problems/${sub.titleSlug}/)`
  return `| ${when} IST | ${link} | ${sub.lang} |`
}

// Rows go directly beneath the marker, which sits above the existing log, so
// the newest submission always reads first.
export function insertRows(readmeText, rows) {
  const at = readmeText.indexOf(LOG_MARKER)
  if (at === -1) throw new Error(`README marker ${LOG_MARKER} not found`)
  const cut = at + LOG_MARKER.length
  return `${readmeText.slice(0, cut)}\n${rows.join('\n')}${readmeText.slice(cut)}`
}

// Every accepted submission, from both of LeetCode's public endpoints.
//
// recentSubmissionList returns each submission individually (so three accepted
// attempts at one problem are three entries) but its window is only the last
// ~20 submissions, failures included. recentAcSubmissionList reaches further
// back but silently collapses a problem to its most recent accept. Unioning
// them by submission id gives every accept in the recent window plus the
// latest accept of older problems.
export function mergeAccepted(allSubmissions, acSubmissions) {
  const byId = new Map()
  for (const sub of allSubmissions) {
    if (sub.statusDisplay === 'Accepted') byId.set(String(sub.id), sub)
  }
  for (const sub of acSubmissions) {
    if (!byId.has(String(sub.id))) byId.set(String(sub.id), sub)
  }
  return [...byId.values()]
}
