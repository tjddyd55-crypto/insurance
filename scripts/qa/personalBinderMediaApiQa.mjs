import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

const BASE = (process.argv[2] || 'https://insurance-dev.up.railway.app').replace(/\/$/, '')
const USERNAME = process.env.COVERAGE_BINDER_QA_USER?.trim()
const PASSWORD = process.env.COVERAGE_BINDER_QA_PASS
const OUT_DIR = join(process.cwd(), 'store-screenshots', 'personal-binder-media')

if (!USERNAME || !PASSWORD) {
  throw new Error('COVERAGE_BINDER_QA_USER / COVERAGE_BINDER_QA_PASS가 필요합니다.')
}

async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body != null && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
  })
  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : Buffer.from(await response.arrayBuffer())
  return { response, payload }
}

function expectStatus(result, status, label) {
  if (result.response.status !== status) {
    throw new Error(`${label}: expected ${status}, got ${result.response.status} ${JSON.stringify(result.payload)}`)
  }
  return result.payload
}

async function makeImage(name, width, height, format) {
  const pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: name.includes('2') ? '#bbf7d0' : '#dbeafe',
    },
  })
  const bytes = format === 'png' ? await pipeline.png().toBuffer() : await pipeline.jpeg().toBuffer()
  return { name, bytes, mime: format === 'png' ? 'image/png' : 'image/jpeg' }
}

async function uploadStorageFile(token, file) {
  const presign = expectStatus(await request('/api/storage/files/presign', {
    token,
    method: 'POST',
    body: { fileName: file.name, contentType: file.mime, size: file.bytes.length, customerId: null },
  }), 200, `presign ${file.name}`)
  const upload = await fetch(new URL(presign.uploadUrl, BASE), {
    method: 'PUT',
    headers: { 'Content-Type': file.mime, ...(presign.putHeaders ?? {}) },
    body: file.bytes,
  })
  if (!upload.ok) throw new Error(`upload ${file.name}: ${upload.status}`)
  return expectStatus(await request('/api/storage/files', {
    token,
    method: 'POST',
    body: {
      fileId: presign.fileId,
      fileName: file.name,
      displayName: file.name,
      objectKey: presign.objectKey,
      fileUrl: presign.fileUrl,
      size: file.bytes.length,
      mimeType: file.mime,
      customerId: null,
    },
  }), 201, `save ${file.name}`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const login = expectStatus(await request('/api/auth/login', {
    method: 'POST',
    body: { username: USERNAME, password: PASSWORD },
  }), 200, 'login')
  const token = login.token
  const images = [
    await makeImage('qa-media-1.jpg', 800, 1200, 'jpeg'),
    await makeImage('qa-media-2.png', 1200, 800, 'png'),
    await makeImage('qa-media-3.jpg', 700, 1000, 'jpeg'),
  ]
  const form = new FormData()
  images.forEach((image) => form.append('images', new Blob([image.bytes], { type: image.mime }), image.name))
  const converted = expectStatus(await request('/api/personal-binders/materials/images-to-pdf', {
    token,
    method: 'POST',
    body: form,
  }), 200, 'images-to-pdf')
  const pdf = await PDFDocument.load(converted)
  if (pdf.getPageCount() !== 3) throw new Error(`merged page count: ${pdf.getPageCount()}`)
  const pageLayouts = pdf.getPages().map((page) => {
    const { width, height } = page.getSize()
    return width > height ? 'landscape' : 'portrait'
  })
  if (pageLayouts.join(',') !== 'portrait,landscape,portrait') {
    throw new Error(`merged page order: ${pageLayouts.join(',')}`)
  }

  const created = []
  const storageIds = []
  let binderId = null
  try {
    for (const image of images) {
      const stored = await uploadStorageFile(token, image)
      storageIds.push(stored.id)
      created.push(expectStatus(await request('/api/personal-binders/materials', {
        token,
        method: 'POST',
        body: { fileId: stored.id, title: image.name.replace(/\.[^.]+$/, '') },
      }), 201, `material ${image.name}`))
    }
    const mergedFile = {
      name: 'qa-media-merged.pdf',
      mime: 'application/pdf',
      bytes: Buffer.from(converted),
    }
    const mergedStored = await uploadStorageFile(token, mergedFile)
    storageIds.push(mergedStored.id)
    const mergedMaterial = expectStatus(await request('/api/personal-binders/materials', {
      token,
      method: 'POST',
      body: { fileId: mergedStored.id, title: 'QA 병합 자료' },
    }), 201, 'merged material')
    created.push(mergedMaterial)
    if (mergedMaterial.pageCount !== 3) throw new Error('merged material page count mismatch')

    const binder = expectStatus(await request('/api/personal-binders', {
      token,
      method: 'POST',
      body: { title: `QA 미디어 정책 ${Date.now()}` },
    }), 201, 'binder')
    binderId = binder.id
    const section = expectStatus(await request(`/api/personal-binders/${binder.id}/sections`, {
      token,
      method: 'POST',
      body: { title: 'PDF 전용' },
    }), 201, 'section')
    const imageInsert = await request(`/api/personal-binders/sections/${section.id}/items`, {
      token,
      method: 'POST',
      body: { materialId: created[0].id, pageSelection: null },
    })
    expectStatus(imageInsert, 400, 'image insertion block')
    if (imageInsert.payload.code !== 'BINDER_REQUIRES_PDF') throw new Error('missing PDF-only policy code')
    expectStatus(await request(`/api/personal-binders/sections/${section.id}/items`, {
      token,
      method: 'POST',
      body: { materialId: mergedMaterial.id, pageSelection: null },
    }), 201, 'merged PDF insertion')

    const result = { separateMaterialCount: 3, mergedPageCount: 3, pageLayouts, pdfOnlyPolicy: true }
    await writeFile(join(OUT_DIR, 'api-qa-results.json'), JSON.stringify(result, null, 2))
    console.log('[PASS] personalBinderMediaApiQa', result)
  } finally {
    if (binderId) await request(`/api/personal-binders/${binderId}`, { token, method: 'DELETE' })
    for (const material of created) {
      await request(`/api/personal-binders/materials/${material.id}`, { token, method: 'DELETE' })
    }
    for (const fileId of storageIds) {
      await request(`/api/storage/files/${fileId}`, { token, method: 'DELETE' })
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
