import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')
const USERNAME = process.env.COVERAGE_BINDER_QA_USER?.trim()
const PASSWORD = process.env.COVERAGE_BINDER_QA_PASS
const PDF_PATH =
  process.env.COVERAGE_BINDER_QA_PDF ||
  join(process.cwd(), 'store-screenshots', 'coverage-simulator', 'pdf', 'coverage-simulator-qa-1p.pdf')
const KEEP_FIXTURE = process.env.COVERAGE_BINDER_QA_KEEP === 'true'
const OUTPUT_DIR = join(process.cwd(), 'store-screenshots', 'personal-binder')

if (!USERNAME || !PASSWORD) {
  throw new Error('COVERAGE_BINDER_QA_USER / COVERAGE_BINDER_QA_PASS가 필요합니다.')
}

async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  return { response, payload }
}

function expectStatus(result, status, label) {
  if (result.response.status !== status) {
    throw new Error(`${label}: expected ${status}, got ${result.response.status} ${JSON.stringify(result.payload)}`)
  }
  return result.payload
}

async function cleanupPreviousQaArtifacts(token) {
  const binders = expectStatus(
    await request('/api/personal-binders', { token }),
    200,
    'preflight binder list',
  )
  for (const binder of binders.filter((entry) => String(entry.title).startsWith('QA 바인더 '))) {
    await request(`/api/personal-binders/${binder.id}`, { token, method: 'DELETE' })
  }
  const materials = expectStatus(
    await request('/api/personal-binders/materials', { token }),
    200,
    'preflight material list',
  )
  for (const material of materials.filter((entry) => String(entry.title).startsWith('QA 자료 '))) {
    const removed = await request(`/api/personal-binders/materials/${material.id}`, {
      token,
      method: 'DELETE',
    })
    if (removed.response.ok && removed.payload?.fileId) {
      await request(`/api/storage/files/${removed.payload.fileId}`, {
        token,
        method: 'DELETE',
      })
    }
  }
  const files = expectStatus(
    await request('/api/storage/files', { token }),
    200,
    'preflight storage list',
  )
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  for (const file of files.filter(
    (entry) =>
      entry.originalName === basename(PDF_PATH) &&
      new Date(entry.createdAt).getTime() >= oneHourAgo,
  )) {
    await request(`/api/storage/files/${file.id}`, { token, method: 'DELETE' })
  }
}

async function main() {
  const login = expectStatus(
    await request('/api/auth/login', {
      method: 'POST',
      body: { username: USERNAME, password: PASSWORD },
    }),
    200,
    'login',
  )
  const token = login.token
  if (!token) throw new Error('login token missing')
  await cleanupPreviousQaArtifacts(token)

  const pdf = await readFile(PDF_PATH)
  const fileName = basename(PDF_PATH)
  const presign = expectStatus(
    await request('/api/storage/files/presign', {
      token,
      method: 'POST',
      body: {
        fileName,
        contentType: 'application/pdf',
        size: pdf.length,
        customerId: null,
      },
    }),
    200,
    'storage presign',
  )
  const uploadUrl = new URL(presign.uploadUrl, BASE).toString()
  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
      ...(presign.putHeaders ?? {}),
    },
    body: pdf,
  })
  if (!upload.ok) throw new Error(`storage upload failed ${upload.status}`)
  const stored = expectStatus(
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

  const material = expectStatus(
    await request('/api/personal-binders/materials', {
      token,
      method: 'POST',
      body: {
        fileId: stored.id,
        title: `QA 자료 ${Date.now()}`,
        ownerUserId: 'attacker-controlled-value',
      },
    }),
    201,
    'material create',
  )
  const binder = expectStatus(
    await request('/api/personal-binders', {
      token,
      method: 'POST',
      body: {
        title: `QA 바인더 ${Date.now()}`,
        description: 'personal binder API E2E',
        ownerUserId: 'attacker-controlled-value',
      },
    }),
    201,
    'binder create',
  )
  const section = expectStatus(
    await request(`/api/personal-binders/${binder.id}/sections`, {
      token,
      method: 'POST',
      body: { title: '암 치료의 변화' },
    }),
    201,
    'section create',
  )
  const item = expectStatus(
    await request(`/api/personal-binders/sections/${section.id}/items`, {
      token,
      method: 'POST',
      body: {
        materialId: material.id,
        pageSelection: material.pageCount > 1 ? [1, 2] : [1],
      },
    }),
    201,
    'item create',
  )
  const detail = expectStatus(
    await request(`/api/personal-binders/${binder.id}`, { token }),
    200,
    'binder detail',
  )
  if (detail.sections?.[0]?.items?.[0]?.pageSelection?.[0] !== 1) {
    throw new Error('page selection mismatch')
  }

  expectStatus(
    await request(`/api/personal-binders/materials/${material.id}`, {
      token,
      method: 'DELETE',
    }),
    409,
    'referenced material protection',
  )
  expectStatus(
    await request(`/api/personal-binders/${binder.id}/sections/reorder`, {
      token,
      method: 'PUT',
      body: { sectionIds: [section.id, '999999999'] },
    }),
    409,
    'reorder foreign id',
  )
  const duplicated = expectStatus(
    await request(`/api/personal-binders/${binder.id}/duplicate`, {
      token,
      method: 'POST',
      body: { title: `${binder.title} 복제` },
    }),
    201,
    'binder duplicate',
  )
  if (duplicated.sections?.[0]?.items?.[0]?.materialId !== material.id) {
    throw new Error('duplicated binder did not reuse material')
  }

  const exported = await fetch(`${BASE}/api/personal-binders/${binder.id}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const exportedBytes = Buffer.from(await exported.arrayBuffer())
  if (!exported.ok || exportedBytes.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error(`binder export failed ${exported.status}`)
  }
  const { PDFDocument } = await import('pdf-lib')
  const exportedPdf = await PDFDocument.load(exportedBytes)
  const expectedPages = Array.isArray(detail.sections?.[0]?.items?.[0]?.pageSelection)
    ? detail.sections[0].items[0].pageSelection.length
    : material.pageCount
  if (exportedPdf.getPageCount() !== expectedPages) {
    throw new Error(`export page count ${exportedPdf.getPageCount()} !== ${expectedPages}`)
  }

  const open = expectStatus(
    await request(`/api/storage/files/${stored.id}/open-token`, {
      token,
      method: 'POST',
      body: { disposition: 'inline' },
    }),
    200,
    'private PDF open token',
  )
  const preview = await fetch(new URL(open.openUrl, BASE))
  if (!preview.ok || !String(preview.headers.get('content-type')).includes('application/pdf')) {
    throw new Error('private PDF preview failed')
  }

  if (KEEP_FIXTURE) {
    await mkdir(OUTPUT_DIR, { recursive: true })
    await writeFile(
      join(OUTPUT_DIR, 'api-e2e-fixture.json'),
      JSON.stringify({
        binderId: binder.id,
        duplicatedBinderId: duplicated.id,
        sectionId: section.id,
        itemId: item.id,
        materialId: material.id,
        fileId: stored.id,
        binderTitle: binder.title,
        materialTitle: material.title,
        pageCount: material.pageCount,
        consultingPageCount: (() => {
          const firstItem = detail.sections?.[0]?.items?.[0]
          const selection = firstItem?.pageSelection
          if (Array.isArray(selection) && selection.length > 0) return selection.length
          if (firstItem?.material?.pageCount) return firstItem.material.pageCount
          return 1
        })(),
      }, null, 2),
    )
  } else {
    expectStatus(
      await request(`/api/personal-binders/${duplicated.id}`, {
        token,
        method: 'DELETE',
      }),
      200,
      'duplicate cleanup',
    )
    expectStatus(
      await request(`/api/personal-binders/items/${item.id}`, {
        token,
        method: 'DELETE',
      }),
      200,
      'item cleanup',
    )
    expectStatus(
      await request(`/api/personal-binders/${binder.id}`, {
        token,
        method: 'DELETE',
      }),
      200,
      'binder cleanup',
    )
    expectStatus(
      await request(`/api/personal-binders/materials/${material.id}`, {
        token,
        method: 'DELETE',
      }),
      200,
      'material cleanup',
    )
    expectStatus(
      await request(`/api/storage/files/${stored.id}`, {
        token,
        method: 'DELETE',
      }),
      200,
      'storage cleanup',
    )
  }

  console.log('[PASS] personalBinderApiE2eQa', {
    binderId: binder.id,
    materialId: material.id,
    pageCount: material.pageCount,
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
