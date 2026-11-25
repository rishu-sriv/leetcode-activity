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
