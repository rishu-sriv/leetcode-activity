import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchRecentAc } from '../scripts/sync.mjs'

const ok = body => async () => ({ ok: true, status: 200, json: async () => body })

test('parses the submission list', async () => {
  const out = await fetchRecentAc('rishu_codes', ok({
    data: { recentAcSubmissionList: [{ id: '1', title: 'T', titleSlug: 't', timestamp: '1795625964', lang: 'cpp' }] },
  }))
  assert.equal(out.length, 1)
  assert.equal(out[0].titleSlug, 't')
})

test('returns empty on a rate-limit response', async () => {
  assert.deepEqual(await fetchRecentAc('u', async () => ({ ok: false, status: 429, json: async () => ({}) })), [])
})

test('returns empty when the body is HTML, not JSON', async () => {
  assert.deepEqual(await fetchRecentAc('u', async () => ({
    ok: true, status: 200, json: async () => { throw new Error('invalid json') },
  })), [])
})

test('returns empty on a graphql error payload', async () => {
  assert.deepEqual(await fetchRecentAc('u', ok({ errors: [{ message: 'nope' }] })), [])
})

test('returns empty when the key is missing from the payload', async () => {
  assert.deepEqual(await fetchRecentAc('u', ok({ data: {} })), [])
})

test('returns empty when the network throws', async () => {
  assert.deepEqual(await fetchRecentAc('u', async () => { throw new Error('ENOTFOUND') }), [])
})
