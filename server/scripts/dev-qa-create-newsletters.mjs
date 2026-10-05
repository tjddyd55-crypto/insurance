/**
 * DEV only — create 4 insurer newsletter QA rows via presign → R2 → publish API.
 * Usage: DATABASE_URL optional (not required). Requires network to DEV API.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const API = process.env.DEV_API_BASE?.replace(/\/$/, '') || 'https://insurance-dev.up.railway.app/api'
const WRITER_USER = process.env.QA_WRITER_USER || 'yjadmin'
const WRITER_PASS = process.env.QA_WRITER_PASS || '1111'
const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'insurance-mobile', 'qa-assets')
const CDN_BASE = String(process.env.R2_PUBLIC_CDN_BASE || 'https://cdn.platform-assets.com').replace(/\/$/, '')

function cdnUrlForObjectKey(objectKey) {
  const key = String(objectKey ?? '').trim().replace(/^\//, '')
  return key ? `${CDN_BASE}/${key}` : ''
}

function slugifyCompanySegment(name) {
  const t = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
  const stripped = t.replace(/[^\w\u3131-\u318e\uac00-\ud7a3-]/g, '')
  return stripped.slice(0, 48) || 'insurer'
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} ${res.status}: ${text.slice(0, 400)}`)
  }
  return json
}

async function login(username, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: { username, password },
  })
  if (!data?.token) throw new Error('login failed')
  return data.token
}

async function ensureAssets() {
  fs.mkdirSync(ASSET_DIR, { recursive: true })
  const files = []
  for (let i = 1; i <= 4; i += 1) {
    const filePath = path.join(ASSET_DIR, `qa-news-image-${i}.png`)
    if (!fs.existsSync(filePath)) {
      const svg = `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#2563eb"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="48" font-family="Arial">QA IMAGE ${i}</text>
      </svg>`
      await sharp(Buffer.from(svg)).png().toFile(filePath)
    }
    files.push(filePath)
  }
  const pdfPath = path.join(ASSET_DIR, 'qa-news-sample.pdf')
  if (!fs.existsSync(pdfPath)) {
    const minimalPdf = `%PDF-1.4
1 0 obj<<>>endobj
2 0 obj<</Length 44>>stream
BT /F1 24 Tf 72 720 Td (QA PDF SAMPLE) Tj ET
endstream
endobj
3 0 obj<</Type/Catalog/Pages 4 0 R>>endobj
4 0 obj<</Type/Pages/Count 1/Kids[5 0 R]>>endobj
5 0 obj<</Type/Page/Parent 4 0 R/MediaBox[0 0 612 792]/Contents 2 0 R>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000032 00000 n 
0000000125 00000 n 
0000000178 00000 n 
0000000235 00000 n 
trailer<</Size 6/Root 3 0 R>>
startxref
334
%%EOF`
    fs.writeFileSync(pdfPath, minimalPdf, 'utf8')
  }
  return { images: files, pdf: pdfPath }
}

async function uploadAttachment(token, filePath, { gaCode, insurerCode, channel }) {
  const fileName = path.basename(filePath)
  const mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png'
  const buf = fs.readFileSync(filePath)
  const presign = await api('/insurer-news/attachments/presign', {
    method: 'POST',
    token,
    body: {
      fileName,
      contentType: mimeType,
      sizeBytes: buf.length,
      gaCode,
      insurerCode,
      channel,
    },
  })
  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: buf,
  })
  if (!putRes.ok) {
    throw new Error(`R2 PUT failed ${putRes.status} for ${fileName}`)
  }
  try {
    await api('/insurer-news/attachments/upload-complete', {
      method: 'POST',
      token,
      body: {
        objectKey: presign.objectKey,
        gaCode,
        insurerCode,
        channel,
      },
    })
  } catch {
    // upload-complete is best-effort telemetry
  }
  const objectKey = String(presign.objectKey ?? '').trim()
  const url = cdnUrlForObjectKey(objectKey)
  if (!objectKey || !url) {
    throw new Error(`presign missing objectKey/url for ${fileName}`)
  }
  console.log(JSON.stringify({ step: 'uploaded', fileName, objectKey, urlPrefix: url.slice(0, 80) }))
  return {
    kind: mimeType === 'application/pdf' ? 'pdf' : 'image',
    url,
    objectKey,
    fileName,
    mimeType,
    size: buf.length,
    sortOrder: 0,
  }
}

async function createPublished(token, draft, attachments, sortStart = 0) {
  const body = {
    ...draft,
    status: 'PUBLISHED',
    channel: 'INSURER',
    attachments: attachments.map((a, idx) => ({ ...a, sortOrder: sortStart + idx })),
  }
  return api('/insurer-news/manager/newsletters', { method: 'POST', token, body })
}

const specs = [
  {
    summary: '[QA] \uC18C\uC2DD\uC9C0 \uCE74\uB4DC \uD14C\uC2A4\uD2B8 1',
    bodyText: 'DEV QA \u2014 \uC774\uBBF8\uC9C0 1\uC7A5 + \uC9E7\uC740 \uBCF8\uBB38\uC785\uB2C8\uB2E4.',
    images: [0],
  },
  {
    summary: '[QA] \uC18C\uC2DD\uC9C0 \uCE74\uB4DC \uD14C\uC2A4\uD2B8 2 - \uAE34 \uC81C\uBAA9 \uB808\uC774\uC544\uC6C3 \uD655\uC778',
    bodyText:
      'DEV QA \u2014 \uAE34 \uC81C\uBAA9 \uB808\uC774\uC544\uC6C3\uACFC \uBCF8\uBB38\uC744 \uD568\uAED8 \uD655\uC778\uD569\uB2C8\uB2E4.',
    images: [1],
  },
  {
    summary: '[QA] \uC18C\uC2DD\uC9C0 \uB2E4\uC911 \uC774\uBBF8\uC9C0 \uD14C\uC2A4\uD2B8',
    bodyText: 'DEV QA \u2014 \uC774\uBBF8\uC9C0 3\uC7A5 \uC774\uC0C1 \uC138\uB85C \uC5F0\uC18D \uD45C\uC2DC\uB97C \uD655\uC778\uD569\uB2C8\uB2E4.',
    images: [0, 1, 2],
  },
  {
    summary: '[QA] \uC18C\uC2DD\uC9C0 \uC774\uBBF8\uC9C0 \uD30C\uC77C \uD63C\uD569 \uD14C\uC2A4\uD2B8',
    bodyText: 'DEV QA \u2014 \uC774\uBBF8\uC9C0 2\uC7A5 + PDF 1\uAC1C \uD63C\uD569 attachment \uD14C\uC2A4\uD2B8\uC785\uB2C8\uB2E4.',
    images: [2, 3],
    pdf: true,
    mixedFileName: 'QA-\uD63C\uD569-\uCCA8\uBD80-\uD14C\uC2A4\uD2B8.pdf',
  },
]

async function resolveWriteScope() {
  // GA_ADMIN(yjadmin) presign scope is tied to insurer master row (한화생명 / INS000006 on DEV).
  const insurerName = '\uD55C\uD654\uC0DD\uBA85'
  return {
    gaCode: 'YJASSET',
    insurerCode: 'INS000006',
    insurerSlug: slugifyCompanySegment(insurerName),
    insurerName,
    source: 'ga-admin-default-insurer',
  }
}

async function main() {
  const token = await login(WRITER_USER, WRITER_PASS)
  const scope = await resolveWriteScope()
  const { gaCode, insurerCode, insurerSlug, insurerName } = scope
  console.log(JSON.stringify({ step: 'write-scope', ...scope }))

  const assets = await ensureAssets()
  const uploaded = []
  for (const imgPath of assets.images) {
    uploaded.push(await uploadAttachment(token, imgPath, { gaCode, insurerCode, channel: 'INSURER' }))
  }
  let pdfAtt = await uploadAttachment(token, assets.pdf, { gaCode, insurerCode, channel: 'INSURER' })
  if (specs[3].mixedFileName) {
    pdfAtt = { ...pdfAtt, fileName: specs[3].mixedFileName }
  }

  const created = []
  for (const spec of specs) {
    const atts = spec.images.map((idx) => uploaded[idx])
    if (spec.pdf) atts.push(pdfAtt)
    const row = await createPublished(
      token,
      {
        gaCode,
        insurerCode,
        insurerSlug,
        insurerName,
        summary: spec.summary,
        bodyText: spec.bodyText,
        publishedAt: new Date().toISOString(),
      },
      atts,
    )
    created.push({ id: row.id, summary: spec.summary })
    console.log(JSON.stringify({ step: 'created', id: row.id, summary: spec.summary }))
  }

  const readerToken = await login('tjddyd55', process.env.QA_READER_PASS || 'QaBizFire20260910!')
  const feed = await api('/insurer-news/feed?gaCode=YJASSET&limit=50&channel=INSURER', { token: readerToken })
  const qaCount = (feed.newsletters || []).filter((n) => String(n.summary || '').startsWith('[QA]')).length
  console.log(JSON.stringify({ step: 'feed-verify', total: feed.newsletters?.length ?? 0, qaCount, created }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
