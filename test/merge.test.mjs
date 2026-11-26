import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeAccepted } from '../scripts/lib.mjs'

const s = (id, status, title = 'Two Sum', timestamp = '1700000000') =>
  ({ id, title, titleSlug: 'two-sum', timestamp, lang: 'cpp', statusDisplay: status })

test('keeps every accepted submission of the same problem', () => {
  const out = mergeAccepted([
    s('3', 'Accepted', 'Two Sum', '1700000200'),
    s('2', 'Accepted', 'Two Sum', '1700000100'),
    s('1', 'Accepted', 'Two Sum', '1700000000'),
  ], [])
  assert.equal(out.length, 3)
})

test('drops submissions that were not accepted', () => {
  const out = mergeAccepted([
    s('1', 'Accepted'), s('2', 'Wrong Answer'), s('3', 'Compile Error'),
    s('4', 'Restrictions Failed'), s('5', 'Time Limit Exceeded'),
  ], [])
  assert.deepEqual(out.map(x => x.id), ['1'])
})

test('unions the deduped AC list without double-counting an id', () => {
  const out = mergeAccepted([s('1', 'Accepted')], [{ id: '1', title: 'Two Sum', titleSlug: 'two-sum', timestamp: '1700000000', lang: 'cpp' }])
  assert.equal(out.length, 1)
})

test('keeps an older problem that only the AC list still reaches', () => {
  const out = mergeAccepted(
    [s('9', 'Accepted', 'Two Sum', '1700000000')],
    [{ id: '5', title: 'Old Problem', titleSlug: 'old', timestamp: '1600000000', lang: 'cpp' }],
  )
  assert.deepEqual(out.map(x => x.id).sort(), ['5', '9'])
})

test('tolerates either source being empty', () => {
  assert.deepEqual(mergeAccepted([], []), [])
  assert.equal(mergeAccepted([], [{ id: '1', title: 'T', titleSlug: 't', timestamp: '1', lang: 'c' }]).length, 1)
})
