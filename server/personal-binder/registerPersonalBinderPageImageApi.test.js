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

import { registerPersonalBinderPageImageApi } from './registerPersonalBinderPageImageApi.js'

const JWT_SECRET = 'binder-page-image-test-secret'

async function twoPagePdf() {
  const doc = await PDFDocument.create()
  const first = doc.addPage([200, 100])
  first.drawRectangle({ x: 0, y: 0, width: 200, height: 100, color: rgb(1, 0, 0) })
  const second = doc.addPage([200, 100])
  second.drawRectangle({ x: 0, y: 0, width: 200, height: 100, color: rgb(0, 0, 1) })
  return Buffer.from(await doc.save())
}

function requireAuth(req, res, next) {
  if (req.headers.authorization === 'Bearer owner') {
    req.user = { id: 'user-a', gaId: 1 }
    next()
    return
  }
  if (req.headers.authorization === 'Bearer other') {
    req.user = { id: 'user-b', gaId: 2 }
    next()
    return
  }
  res.status(401).json({ message: '로그인이 필요합니다.' })
}

function createHarness(pdf, png) {
  const reads = []
  const queries = []
  const pdfChecksum = createHash('sha256').update(pdf).digest('hex')
  const pngChecksum = createHash('sha256').update(png).digest('hex')
  const materialRow = {
    id: 3,
    file_id: 4,
    page_count: 2,
    checksum_sha256: pdfChecksum,
    material_mime: 'application/pdf',
    file_path: 'insurance/ga/users/user-a/personal-files/a.pdf',
    file_mime: 'application/pdf',
    file_size: pdf.length,
  }
  const imageRow = {
    ...materialRow,
    id: 7,
    file_id: 8,
    page_count: 1,
    checksum_sha256: pngChecksum,
    material_mime: 'image/png',
    file_mime: 'image/png',
    file_path: 'insurance/ga/users/user-a/personal-files/a.png',
    file_size: png.length,
  }
  const pool = {
    query: async (sql, params) => {
      const text = String(sql)
      queries.push({ sql: text, params })
      const userId = params?.[1]
      const gaId = Number(params?.[2])
      if (text.includes('owner_user_id') && (userId !== 'user-a' || gaId !== 1)) {
        return { rows: [], rowCount: 0 }
      }
      if (text.includes('file_path')) {
        const row = Number(params?.[0]) === 7 ? imageRow : materialRow
        return { rows: [row], rowCount: 1 }
      }
      if (text.includes('SELECT id, title, description')) {
        return {
          rows: [{ id: 5, title: '상담책', description: '', created_at: 't', updated_at: 't' }],
          rowCount: 1,
        }
      }
      if (text.includes('FROM personal_binder_sections')) {
        return {
          rows: [{ id: 8, title: '보장', sort_order: 0, created_at: 't', updated_at: 't' }],
          rowCount: 1,
        }
      }
      if (text.includes('FROM personal_binder_items')) {
        return {
          rows: [{
            id: 9,
            section_id: 8,
            material_id: 3,
            sort_order: 0,
            page_selection: [2, 1],
            created_at: 't',
            updated_at: 't',
            file_id: 4,
            material_title: '자료',
            original_file_name: 'a.pdf',
            mime_type: 'application/pdf',
            file_size: pdf.length,
            page_count: 2,
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  return { pool, queries, reads, materialRow, imageRow }
}

async function startServer(pdf, png, cacheDir) {
  const harness = createHarness(pdf, png)
  const app = express()
  app.use(express.json())
  registerPersonalBinderPageImageApi(app, {
    pool: harness.pool,
    requireAuth,
    handleDbError: (error, _req, res) => {
      res.status(500).json({ message: error?.message ?? 'error' })
    },
    JWT_SECRET,
    cacheDir,
    readFileBuffer: async (filePath) => {
      harness.reads.push(filePath)
      if (String(filePath).endsWith('.png')) return png
      return pdf
    },
  })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { server, base: `http://127.0.0.1:${server.address().port}`, harness }
}

async function request(base, urlPath, { token, headers } = {}) {
  const response = await fetch(`${base}${urlPath}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return { response, body: await response.json(), bytes: null }
  }
  return { response, body: null, bytes: Buffer.from(await response.arrayBuffer()) }
}

test('personal binder page image API scopes owner and GA and renders pages', async () => {
  const pdf = await twoPagePdf()
  const png = await sharp({
    create: { width: 80, height: 40, channels: 3, background: { r: 10, g: 20, b: 30 } },
  }).png().toBuffer()
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'binder-page-http-'))
  const { server, base, harness } = await startServer(pdf, png, cacheDir)
  try {
    const anonymous = await request(base, '/personal-binders/materials/3/pages')
    assert.equal(anonymous.response.status, 401)

    const foreign = await request(base, '/personal-binders/materials/3/pages', { token: 'other' })
    assert.equal(foreign.response.status, 404)
    assert.deepEqual(harness.queries.at(-1).params, [3, 'user-b', 2])
    assert.match(harness.queries.at(-1).sql, /owner_user_id = \$2/)
    assert.match(harness.queries.at(-1).sql, /ga_id = \$3/)
    assert.equal(harness.reads.length, 0)

    const foreignBinder = await request(base, '/personal-binders/9/pages', { token: 'other' })
    assert.equal(foreignBinder.response.status, 404)

    const meta = await request(base, '/personal-binders/materials/3/pages', { token: 'owner' })
    assert.equal(meta.response.status, 200)
    assert.equal(meta.body.pageCount, 2)
    assert.equal(meta.body.kind, 'pdf')
    assert.equal(meta.body.fileId, 4)
    assert.equal(meta.response.headers.get('cache-control'), 'private, no-store')

    const link = await request(base, '/personal-binders/materials/3/pages/2?width=1000', { token: 'owner' })
    assert.equal(link.response.status, 200)
    assert.equal(link.body.width, 1080)
    assert.equal(link.body.page, 2)
    assert.equal(link.body.access, 'open-token')
    assert.equal(link.response.headers.get('cache-control'), 'no-store')
    assert.match(link.body.openPath, /^\/api\/personal-binders\/page-images\/open\//)
    assert.equal(harness.reads.length, 0)

    const openPath = link.body.openPath.replace('/api', '')
    const opened = await request(base, openPath)
    assert.equal(opened.response.status, 200)
    assert.match(opened.response.headers.get('content-type'), /image\/jpeg/)
    assert.equal(opened.response.headers.get('cache-control'), 'private, max-age=300')
    assert.equal(opened.response.headers.get('x-page-image-cache'), 'miss')
    assert.equal(opened.bytes[0], 0xff)
    assert.equal(opened.bytes[1], 0xd8)
    const blue = (await sharp(opened.bytes).stats()).channels.map((channel) => Math.round(channel.mean))
    assert.ok(blue[2] > 200 && blue[0] < 40)

    const again = await request(base, '/personal-binders/materials/3/pages/2/image?width=1080', { token: 'owner' })
    assert.equal(again.response.status, 200)
    assert.equal(again.response.headers.get('cache-control'), 'private, max-age=86400')
    assert.equal(again.response.headers.get('x-page-image-cache'), 'hit')
    assert.equal(harness.reads.length, 1)

    const thumb = await request(base, '/personal-binders/materials/3/pages/1/image?preset=thumb', { token: 'owner' })
    assert.equal(thumb.response.headers.get('x-image-width'), '240')
    assert.equal(thumb.response.headers.get('x-image-height'), '120')

    const outOfRange = await request(base, '/personal-binders/materials/3/pages/9', { token: 'owner' })
    assert.equal(outOfRange.response.status, 400)

    const binderPages = await request(base, '/personal-binders/5/pages', { token: 'owner' })
    assert.equal(binderPages.response.status, 200)
    assert.equal(binderPages.body.pageCount, 2)
    assert.deepEqual(
      binderPages.body.pages.map((page) => page.pdfPageNumber),
      [2, 1],
    )

    const binderImage = await request(base, '/personal-binders/5/pages/1/image?width=240', { token: 'owner' })
    assert.equal(binderImage.response.status, 200)
    const viewerBlue = (await sharp(binderImage.bytes).stats()).channels.map((channel) => Math.round(channel.mean))
    assert.ok(viewerBlue[2] > 200)

    const imageMeta = await request(base, '/personal-binders/materials/7/pages', { token: 'owner' })
    assert.equal(imageMeta.body.kind, 'image')
    assert.equal(imageMeta.body.pageCount, 1)
    const imageBytes = await request(base, '/personal-binders/materials/7/pages/1/image?width=1080', { token: 'owner' })
    assert.equal(imageBytes.response.status, 200)
    assert.equal(imageBytes.response.headers.get('x-image-width'), '80')
    assert.equal(imageBytes.response.headers.get('x-image-height'), '40')
  } finally {
    server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})

test('personal binder page image routes keep owner and GA in the query', async () => {
  const source = await readFile(new URL('./registerPersonalBinderPageImageApi.js', import.meta.url), 'utf8')
  const loader = await readFile(new URL('./loadOwnedBinderMaterialFile.js', import.meta.url), 'utf8')
  assert.match(loader, /m\.owner_user_id = \$2/)
  assert.match(loader, /m\.ga_id = \$3/)
  assert.match(loader, /f\.user_id = \$2/)
  assert.match(loader, /f\.ga_id = \$3/)
  assert.match(source, /loadBinderDetail/)
  assert.doesNotMatch(source, /ownerUserId|file_path|objectKey/)
})
