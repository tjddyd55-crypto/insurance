import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import express from 'express'
import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'

import { binderPageImageCacheKey } from './binderPageImageCache.js'
import { issueBinderPageImageToken } from './binderPageImageToken.js'
import { registerPersonalBinderPageImageApi } from './registerPersonalBinderPageImageApi.js'
import { registerSharedBinderPageImageApi } from './registerSharedBinderPageImageApi.js'
import { listSharedBinderViewerPages } from './sharedBinderViewerPages.js'

const JWT_SECRET = 'shared-binder-page-image-test-secret'
const USERS = {
  owner: { id: 'user-a', gaId: 1 },
  recipient: { id: 'user-c', gaId: 1 },
  stranger: { id: 'user-b', gaId: 2 },
}

async function twoPagePdf() {
  const doc = await PDFDocument.create()
  doc.addPage([200, 100]).drawRectangle({ x: 0, y: 0, width: 200, height: 100, color: rgb(1, 0, 0) })
  doc.addPage([200, 100]).drawRectangle({ x: 0, y: 0, width: 200, height: 100, color: rgb(0, 0, 1) })
  return Buffer.from(await doc.save())
}

function requireAuth(req, res, next) {
  const key = String(req.headers.authorization ?? '').replace(/^Bearer /, '')
  if (USERS[key]) {
    req.user = USERS[key]
    next()
    return
  }
  res.status(401).json({ message: '로그인이 필요합니다.' })
}

function createHarness(pdf) {
  const state = { status: 'active' }
  const reads = []
  const queries = []
  const checksum = createHash('sha256').update(pdf).digest('hex')
  const pool = {
    query: async (sql, params) => {
      const text = String(sql)
      queries.push({ sql: text, params })
      if (text.includes('FROM personal_binder_ga_share_files f') && text.includes('INNER JOIN personal_binder_ga_shares s')) {
        // loadActiveSharedBinderFile: [shareFileId, shareId, gaId]
        const ok = Number(params[0]) === 31 && Number(params[1]) === 21 && Number(params[2]) === 1 && state.status === 'active'
        return ok
          ? { rows: [{ share_file_id: 31, share_id: 21, file_path: 'insurance/ga/shares/21/a.pdf', file_mime: 'application/pdf', file_size: pdf.length, page_count: 2, checksum_sha256: checksum }], rowCount: 1 }
          : { rows: [], rowCount: 0 }
      }
      if (text.includes('FROM personal_binder_ga_shares s') && text.includes('LEFT JOIN users')) {
        const ok = Number(params[0]) === 21 && Number(params[1]) === 1
        return ok
          ? { rows: [{ id: 21, title: '공유 상담책', description: '', owner_user_id: 'user-a', owner_name: 'A', ga_id: 1, section_count: 1, file_count: 1, total_bytes: pdf.length, share_version: 1, source_binder_id: 5, created_at: 't', status: state.status }], rowCount: 1 }
          : { rows: [], rowCount: 0 }
      }
      if (text.includes('FROM personal_binder_ga_share_sections')) {
        return { rows: [{ id: 41, title: '보장', sort_order: 0 }], rowCount: 1 }
      }
      if (text.includes('FROM personal_binder_ga_share_items')) {
        return {
          rows: [{ id: 51, share_section_id: 41, share_file_id: 31, sort_order: 0, page_selection: [2, 1], material_title: '자료', original_file_name: 'a.pdf', mime_type: 'application/pdf', file_size: pdf.length, page_count: 2 }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  return { pool, state, reads, queries }
}

async function startServer(pdf, cacheDir) {
  const harness = createHarness(pdf)
  const app = express()
  const ctx = {
    pool: harness.pool,
    requireAuth,
    handleDbError: (error, _req, res) => res.status(500).json({ message: error?.message ?? 'error' }),
    JWT_SECRET,
    cacheDir,
    readFileBuffer: async (filePath) => {
      harness.reads.push(filePath)
      return pdf
    },
  }
  const own = registerPersonalBinderPageImageApi(app, ctx)
  registerSharedBinderPageImageApi(app, { ...ctx, service: own.service })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { server, base: `http://127.0.0.1:${server.address().port}`, harness }
}

async function request(base, urlPath, token) {
  const response = await fetch(`${base}${urlPath}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return { response, body: await response.json(), bytes: null }
  return { response, body: null, bytes: Buffer.from(await response.arrayBuffer()) }
}

function meanBlue(bytes) {
  return sharp(bytes).stats().then((stats) => stats.channels.map((channel) => Math.round(channel.mean)))
}

test('shared binder page images: owner and same-GA recipient can view, stranger and revoked cannot', async () => {
  const pdf = await twoPagePdf()
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'shared-binder-page-'))
  const { server, base, harness } = await startServer(pdf, cacheDir)
  try {
    assert.equal((await request(base, '/personal-binders/shared/21/pages')).response.status, 401)
    assert.equal((await request(base, '/personal-binders/shared/abc/pages', 'recipient')).response.status, 400)

    for (const who of ['owner', 'recipient']) {
      const pages = await request(base, '/personal-binders/shared/21/pages', who)
      assert.equal(pages.response.status, 200, who)
      assert.equal(pages.response.headers.get('cache-control'), 'private, no-store')
      assert.equal(pages.body.shareId, '21')
      assert.equal(pages.body.pageCount, 2)
      assert.deepEqual(pages.body.pages.map((page) => page.pdfPageNumber), [2, 1])
      assert.deepEqual(pages.body.pages.map((page) => page.index), [1, 2])
      assert.equal(pages.body.pages[0].shareFileId, '31')
      assert.equal(pages.body.pages[0].sectionTitle, '보장')
    }

    const link = await request(base, '/personal-binders/shared/21/pages/1?width=1000', 'recipient')
    assert.equal(link.response.status, 200)
    assert.equal(link.response.headers.get('cache-control'), 'no-store')
    assert.equal(link.body.width, 1080)
    assert.equal(link.body.page, 2)
    assert.equal(link.body.access, 'open-token')
    assert.match(link.body.openPath, /^\/api\/personal-binders\/shared\/page-images\/open\//)
    assert.equal(harness.reads.length, 0)

    const openPath = link.body.openPath.replace('/api', '')
    const opened = await request(base, openPath)
    assert.equal(opened.response.status, 200)
    assert.match(opened.response.headers.get('content-type'), /image\/jpeg/)
    assert.equal(opened.response.headers.get('cache-control'), 'private, max-age=300')
    const blue = await meanBlue(opened.bytes)
    assert.ok(blue[2] > 200 && blue[0] < 40)
    assert.deepEqual(harness.reads, ['insurance/ga/shares/21/a.pdf'])

    const bytes = await request(base, '/personal-binders/shared/21/pages/2/image?width=1080', 'owner')
    assert.equal(bytes.response.status, 200)
    assert.equal(bytes.response.headers.get('cache-control'), 'private, max-age=86400')
    const red = await meanBlue(bytes.bytes)
    assert.ok(red[0] > 200 && red[2] < 40)

    const cached = await request(base, '/personal-binders/shared/21/pages/1/image?width=1080', 'recipient')
    assert.equal(cached.response.headers.get('x-page-image-cache'), 'hit')

    assert.equal((await request(base, '/personal-binders/shared/21/pages/9', 'recipient')).response.status, 400)

    // 다른 GA: 공유 행 자체를 못 찾는다(404). 렌더·파일 읽기 없음.
    const readsBefore = harness.reads.length
    for (const suffix of ['pages', 'pages/1', 'pages/1/image']) {
      assert.equal((await request(base, `/personal-binders/shared/21/${suffix}`, 'stranger')).response.status, 404, suffix)
    }
    assert.equal(harness.reads.length, readsBefore)

    // 해제: 목록·링크·바이트 모두 404, 이미 받은 열기 토큰도 404.
    harness.state.status = 'revoked'
    for (const suffix of ['pages', 'pages/1', 'pages/1/image']) {
      assert.equal((await request(base, `/personal-binders/shared/21/${suffix}`, 'recipient')).response.status, 404, suffix)
    }
    assert.equal((await request(base, openPath)).response.status, 404)

    // 토큰 범위 분리: 위조·개인 바인더 토큰으로 공유 열기 불가, 공유 토큰으로 개인 열기 불가.
    assert.equal((await request(base, '/personal-binders/shared/page-images/open/not-a-token')).response.status, 410)
    const ownToken = issueBinderPageImageToken(JWT_SECRET, { userId: 'user-a', gaId: 1, materialId: 31, fileId: 31, page: 1, width: 1080 })
    assert.equal((await request(base, `/personal-binders/shared/page-images/open/${ownToken}`)).response.status, 410)
    const sharedToken = decodeURIComponent(openPath.split('/').at(-1))
    assert.equal((await request(base, `/personal-binders/page-images/open/${sharedToken}`)).response.status, 410)
  } finally {
    server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})

test('shared binder page file access re-checks GA and active share in SQL', async () => {
  const loader = await readFile(new URL('./loadActiveSharedBinderFile.js', import.meta.url), 'utf8')
  assert.match(loader, /f\.ga_id = \$3/)
  assert.match(loader, /s\.status = 'active'/)
  assert.match(loader, /s\.ga_id = f\.ga_id/)
  const routes = await readFile(new URL('./registerSharedBinderPageImageApi.js', import.meta.url), 'utf8')
  assert.match(routes, /loadSharedBinderDetail/)
  assert.doesNotMatch(routes, /renderBinderPageImage\(|INSERT|UPDATE|DELETE FROM/)
})

test('shared viewer pages reuse the personal binder order and cache keys are namespaced', () => {
  const pages = listSharedBinderViewerPages({
    sections: [
      { id: '2', title: 'B', sortOrder: 1, items: [{ id: '9', shareFileId: '7', sortOrder: 0, pageSelection: null, material: { mimeType: 'image/png', pageCount: 0 } }] },
      { id: '1', title: 'A', sortOrder: 0, items: [{ id: '8', shareFileId: '6', sortOrder: 0, pageSelection: [3], material: { mimeType: 'application/pdf', pageCount: 3 } }] },
    ],
  })
  assert.deepEqual(pages.map((page) => [page.index, page.sectionTitle, page.shareFileId, page.pdfPageNumber, page.kind]), [
    [1, 'A', '6', 3, 'pdf'],
    [2, 'B', '7', 1, 'image'],
  ])
  const own = binderPageImageCacheKey({ fileId: 5, fingerprint: 'abcdef0123456789', page: 1, width: 1080 })
  const shared = binderPageImageCacheKey({ fileId: 5, fingerprint: 'abcdef0123456789', page: 1, width: 1080, namespace: 'share' })
  assert.equal(own, path.join('5', 'abcdef0123456789', '1', '1080'))
  assert.equal(shared, path.join('share', '5', 'abcdef0123456789', '1', '1080'))
  assert.throws(() => binderPageImageCacheKey({ fileId: 5, fingerprint: 'abcdef0123456789', page: 1, width: 1080, namespace: '../x' }))
})
