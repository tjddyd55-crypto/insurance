/**
 * DEV 개인 바인더 페이지 이미지 검증.
 * 자격 증명은 환경변수로만 받는다.
 *
 * PERSONAL_BINDER_QA_USER / PERSONAL_BINDER_QA_PASS
 * PERSONAL_BINDER_QA_OTHER_USER / PERSONAL_BINDER_QA_OTHER_PASS (생략 시 같은 비밀번호)
 */
import { createHash } from 'node:crypto'

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const BASE = (process.env.PERSONAL_BINDER_QA_BASE || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const USERNAME = process.env.PERSONAL_BINDER_QA_USER?.trim()
const PASSWORD = process.env.PERSONAL_BINDER_QA_PASS
const OTHER_USERNAME = process.env.PERSONAL_BINDER_QA_OTHER_USER?.trim()
const OTHER_PASSWORD = process.env.PERSONAL_BINDER_QA_OTHER_PASS || PASSWORD
const TITLE_PREFIX = 'QA page-image '

if (!USERNAME || !PASSWORD || !OTHER_USERNAME) {
  throw new Error('PERSONAL_BINDER_QA_USER / PASS / OTHER_USER 가 필요합니다.')
}

async function request(urlPath, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('json')) {
    return { response, payload: await response.json(), bytes: null }
  }
  return { response, payload: null, bytes: Buffer.from(await response.arrayBuffer()) }
}

function expectStatus(result, status, label) {
  if (result.response.status !== status) {
    throw new Error(`${label}: expected ${status}, got ${result.response.status} ${JSON.stringify(result.payload)}`)
  }
  return result.payload
}

async function login(username, password) {
  const payload = expectStatus(
    await request('/api/auth/login', { method: 'POST', body: { username, password } }),
    200,
    `login ${username}`,
  )
  if (!payload?.token) throw new Error(`login token missing for ${username}`)
  return payload.token
}

async function cleanup(token) {
  const binders = expectStatus(await request('/api/personal-binders', { token }), 200, 'list binders')
  for (const binder of binders.filter((entry) => String(entry.title).startsWith(TITLE_PREFIX))) {
    expectStatus(
      await request(`/api/personal-binders/${binder.id}`, { token, method: 'DELETE' }),
      200,
      `delete binder ${binder.id}`,
    )
  }
  const materials = expectStatus(await request('/api/personal-binders/materials', { token }), 200, 'list materials')
  for (const material of materials.filter((entry) => String(entry.title).startsWith(TITLE_PREFIX))) {
    const removed = expectStatus(
      await request(`/api/personal-binders/materials/${material.id}`, { token, method: 'DELETE' }),
      200,
      `delete material ${material.id}`,
    )
    if (removed?.fileId) {
      await request(`/api/storage/files/${removed.fileId}`, { token, method: 'DELETE' })
    }
  }
}

async function buildPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const [label, color] of [['PAGE-1', rgb(0.85, 0.1, 0.1)], ['PAGE-2', rgb(0.1, 0.15, 0.85)]]) {
    const page = doc.addPage([320, 180])
    page.drawRectangle({ x: 0, y: 0, width: 320, height: 180, color })
    page.drawText(label, { x: 24, y: 80, size: 28, font, color: rgb(1, 1, 1) })
  }
  return Buffer.from(await doc.save())
}

async function uploadPdf(token, pdf) {
  const fileName = 'qa-page-image.pdf'
  const presign = expectStatus(
    await request('/api/storage/files/presign', {
      token,
      method: 'POST',
      body: { fileName, contentType: 'application/pdf', size: pdf.length, customerId: null },
    }),
    200,
    'presign',
  )
  const upload = await fetch(new URL(presign.uploadUrl, BASE), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf', ...(presign.putHeaders ?? {}) },
    body: pdf,
  })
  if (!upload.ok) throw new Error(`storage upload failed ${upload.status}`)
  return expectStatus(
    await request('/api/storage/files', {
      token,
      method: 'POST',
      body: {
        fileId: presign.fileId,
        fileName,
        displayName: fileName,
        objectKey: presign.objectKey,
        fileUrl: presign.fileUrl,
        size: pdf.length,
        mimeType: 'application/pdf',
        customerId: null,
      },
    }),
    201,
    'storage save',
  )
}

function assertJpeg(result, label) {
  if (result.response.status !== 200) {
    throw new Error(`${label}: image status ${result.response.status}`)
  }
  if (!result.bytes || result.bytes[0] !== 0xff || result.bytes[1] !== 0xd8) {
    throw new Error(`${label}: not a jpeg`)
  }
  if (result.bytes.length < 500) throw new Error(`${label}: jpeg too small`)
}

async function main() {
  const token = await login(USERNAME, PASSWORD)
  await cleanup(token)
  const pdf = await buildPdf()
  const stored = await uploadPdf(token, pdf)
  const material = expectStatus(
    await request('/api/personal-binders/materials', {
      token,
      method: 'POST',
      body: { fileId: stored.id, title: `${TITLE_PREFIX}${Date.now()}` },
    }),
    201,
    'material',
  )
  if (Number(material.pageCount) !== 2) throw new Error(`pageCount ${material.pageCount}`)
  const binder = expectStatus(
    await request('/api/personal-binders', {
      token,
      method: 'POST',
      body: { title: `${TITLE_PREFIX}${Date.now()}`, description: 'page image qa' },
    }),
    201,
    'binder',
  )
  const section = expectStatus(
    await request(`/api/personal-binders/${binder.id}/sections`, {
      token,
      method: 'POST',
      body: { title: 'QA' },
    }),
    201,
    'section',
  )
  expectStatus(
    await request(`/api/personal-binders/sections/${section.id}/items`, {
      token,
      method: 'POST',
      body: { materialId: material.id, pageSelection: [1, 2] },
    }),
    201,
    'item',
  )

  const meta = expectStatus(
    await request(`/api/personal-binders/materials/${material.id}/pages`, { token }),
    200,
    'material pages',
  )
  const viewer = expectStatus(
    await request(`/api/personal-binders/${binder.id}/pages`, { token }),
    200,
    'binder pages',
  )
  if (meta.pageCount !== 2 || viewer.pageCount !== 2) throw new Error('unexpected page count')

  const pageOne = await request(
    `/api/personal-binders/materials/${material.id}/pages/1/image?width=240`,
    { token },
  )
  const pageTwo = await request(
    `/api/personal-binders/${binder.id}/pages/2/image?preset=full`,
    { token },
  )
  assertJpeg(pageOne, 'thumb')
  assertJpeg(pageTwo, 'full')
  if (pageOne.response.headers.get('x-image-width') !== '240') throw new Error('thumb width')
  const fullWidth = Number(pageTwo.response.headers.get('x-image-width'))
  if (fullWidth < 1080 || fullWidth > 1600) throw new Error(`full width ${fullWidth}`)
  const hashOne = createHash('sha256').update(pageOne.bytes).digest('hex')
  const hashTwo = createHash('sha256').update(pageTwo.bytes).digest('hex')
  if (hashOne === hashTwo) throw new Error('page images are identical')

  const link = expectStatus(
    await request(`/api/personal-binders/materials/${material.id}/pages/1?width=1080`, { token }),
    200,
    'open link',
  )
  const opened = await fetch(link.openUrl)
  const openedBytes = Buffer.from(await opened.arrayBuffer())
  if (!opened.ok || openedBytes[0] !== 0xff || openedBytes[1] !== 0xd8) {
    throw new Error(`open url failed ${opened.status}`)
  }

  const cached = await request(
    `/api/personal-binders/materials/${material.id}/pages/1/image?width=1080`,
    { token },
  )
  assertJpeg(cached, 'cached full')
  if (cached.response.headers.get('x-page-image-cache') !== 'hit') {
    throw new Error(`expected cache hit, got ${cached.response.headers.get('x-page-image-cache')}`)
  }

  const other = await login(OTHER_USERNAME, OTHER_PASSWORD)
  const idorMaterial = await request(`/api/personal-binders/materials/${material.id}/pages`, { token: other })
  const idorBinder = await request(`/api/personal-binders/${binder.id}/pages`, { token: other })
  const idorImage = await request(
    `/api/personal-binders/materials/${material.id}/pages/1/image?width=240`,
    { token: other },
  )
  for (const [label, result] of [['material', idorMaterial], ['binder', idorBinder], ['image', idorImage]]) {
    if (![403, 404].includes(result.response.status)) {
      throw new Error(`idor ${label}: expected 403/404, got ${result.response.status}`)
    }
  }

  await cleanup(token)
  console.log(JSON.stringify({
    ok: true,
    base: BASE,
    materialId: material.id,
    binderId: binder.id,
    pageCount: meta.pageCount,
    viewerPages: viewer.pages.map((page) => page.pdfPageNumber),
    thumbBytes: pageOne.bytes.length,
    fullBytes: pageTwo.bytes.length,
    fullWidth,
    openStatus: opened.status,
    cache: cached.response.headers.get('x-page-image-cache'),
    idor: [idorMaterial.response.status, idorBinder.response.status, idorImage.response.status],
  }))
}

main().catch(async (error) => {
  console.error(error)
  try {
    const token = await login(USERNAME, PASSWORD)
    await cleanup(token)
    console.error('cleanup completed after failure')
  } catch (cleanupError) {
    console.error('cleanup failed', cleanupError)
  }
  process.exit(1)
})
