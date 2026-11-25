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

test('matches ids regardless of string or number type', () => {
  const out = newSubmissions([sub(1, '1700000000'), sub(2, '1700000100')], ['1'])
  assert.deepEqual(out.map(s => String(s.id)), ['2'])
})

test('empty api list yields nothing', () => {
  assert.deepEqual(newSubmissions([], ['1']), [])
})

test('stamps the date in IST with a literal +0530 offset', () => {
  // 1795625964 = 2026-11-25 22:29:24 IST
  assert.equal(istCommitDate('1795625964'), '2026-11-25 22:29:24 +0530')
})

test('a submission one minute before IST midnight keeps its own day', () => {
  // 1795631340 = 2026-11-25 23:59:00 IST, 60s later = 2026-11-26 00:00:00 IST
  assert.equal(istCommitDate('1795631340'), '2026-11-25 23:59:00 +0530')
  assert.equal(istCommitDate(1795631400), '2026-11-26 00:00:00 +0530')
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
