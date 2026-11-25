#!/usr/bin/env node
// Polls LeetCode for newly accepted submissions and turns each one into a
// commit authored by the user, so it registers on their contribution graph.
// Idempotent: data/seen.json is the ledger of submission ids already committed,
// which is what makes an overlapping or replayed cron tick a no-op.

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { argv, env, exit } from 'node:process'
import { newSubmissions, istCommitDate, readmeRow, insertRows } from './lib.mjs'

const USERNAME = env.LEETCODE_USERNAME || 'rishu_codes'
const AUTHOR = 'rishu-sriv <180553705+rishu-sriv@users.noreply.github.com>'
const SEEN_PATH = new URL('../data/seen.json', import.meta.url)
const README_PATH = new URL('../README.md', import.meta.url)

const QUERY = `query($u:String!,$n:Int!){
  recentAcSubmissionList(username:$u,limit:$n){id title titleSlug timestamp lang}
}`

// Never throws and never reports a partial list: a bad tick must be a no-op,
// not a failed workflow run and not a reason to drop ids from the ledger.
export async function fetchRecentAc(username, fetchImpl = fetch) {
  try {
    const res = await fetchImpl('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: `https://leetcode.com/u/${username}/`,
        'User-Agent': 'leetcode-activity-sync',
      },
      body: JSON.stringify({ query: QUERY, variables: { u: username, n: 20 } }),
    })
    if (!res.ok) {
      console.warn(`leetcode responded ${res.status}; treating as nothing new`)
      return []
    }
    const body = await res.json()
    if (body?.errors?.length) {
      console.warn(`leetcode graphql errors: ${JSON.stringify(body.errors)}`)
      return []
    }
    const list = body?.data?.recentAcSubmissionList
    if (!Array.isArray(list)) {
      console.warn('leetcode payload had no recentAcSubmissionList; treating as nothing new')
      return []
    }
    return list
  } catch (err) {
    console.warn(`could not reach leetcode (${err.message}); treating as nothing new`)
    return []
  }
}

function readSeen() {
  try {
    const parsed = JSON.parse(readFileSync(SEEN_PATH, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// One commit per submission, each stamped with that submission's own IST time,
// so every solve gets its own correctly-dated square.
function commitSubmission(sub) {
  const date = istCommitDate(sub.timestamp)
  execFileSync('git', ['add', 'README.md', 'data/seen.json'])
  execFileSync('git', ['commit', '--author', AUTHOR, '-m', `solved: ${sub.title} (${sub.lang})`], {
    env: { ...env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    stdio: 'inherit',
  })
}

async function main() {
  const seen = readSeen()
  const fresh = newSubmissions(await fetchRecentAc(USERNAME), seen)
  if (fresh.length === 0) {
    console.log('nothing new')
    return
  }
  for (const sub of fresh) {
    writeFileSync(README_PATH, insertRows(readFileSync(README_PATH, 'utf8'), [readmeRow(sub)]))
    seen.push(String(sub.id))
    writeFileSync(SEEN_PATH, `${JSON.stringify(seen, null, 2)}\n`)
    commitSubmission(sub)
    console.log(`committed: ${sub.title}`)
  }
  console.log(`${fresh.length} new submission(s)`)
}

if (argv[1] === new URL(import.meta.url).pathname) {
  main().catch(err => {
    console.error(err)
    exit(1)
  })
}
