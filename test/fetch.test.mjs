import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchRecentAc, fetchAccepted } from '../scripts/sync.mjs'

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

// --- both-endpoint fetch ---

const bodyFor = (q, all, ac) => q.includes('recentSubmissionList')
  ? { data: { recentSubmissionList: all } }
  : { data: { recentAcSubmissionList: ac } }

const twoEndpoint = (all, ac) => async (_url, opts) => ({
  ok: true, status: 200,
  json: async () => bodyFor(JSON.parse(opts.body).query, all, ac),
})

test('returns every accepted submission of one problem', async () => {
  const all = [
    { id: '3', title: 'Two Sum', titleSlug: 'two-sum', timestamp: '1700000200', lang: 'cpp', statusDisplay: 'Accepted' },
    { id: '2', title: 'Two Sum', titleSlug: 'two-sum', timestamp: '1700000100', lang: 'cpp', statusDisplay: 'Wrong Answer' },
    { id: '1', title: 'Two Sum', titleSlug: 'two-sum', timestamp: '1700000000', lang: 'cpp', statusDisplay: 'Accepted' },
  ]
  const ac = [{ id: '3', title: 'Two Sum', titleSlug: 'two-sum', timestamp: '1700000200', lang: 'cpp' }]
  const out = await fetchAccepted('u', twoEndpoint(all, ac))
  assert.deepEqual(out.map(s => s.id).sort(), ['1', '3'])
})

test('still returns the AC list when the per-submission endpoint fails', async () => {
  const fetchImpl = async (_url, opts) => JSON.parse(opts.body).query.includes('recentSubmissionList')
    ? { ok: false, status: 403, json: async () => ({}) }
    : { ok: true, status: 200, json: async () => ({ data: { recentAcSubmissionList: [{ id: '7', title: 'T', titleSlug: 't', timestamp: '1', lang: 'c' }] } }) }
  const out = await fetchAccepted('u', fetchImpl)
  assert.deepEqual(out.map(s => s.id), ['7'])
})

test('returns empty when both endpoints fail', async () => {
  assert.deepEqual(await fetchAccepted('u', async () => { throw new Error('ENOTFOUND') }), [])
})
