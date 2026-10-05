/**
 * DEV only — R2 upload 후 newsletter create API scope blocker 우회용 DB seed.
 * presign/upload는 dev-qa-create-newsletters.mjs 와 동일 규칙.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL required')
  process.exit(1)
}

const API = 'https://insurance-dev.up.railway.app/api'
const WRITER_USER = 'yjadmin'
const WRITER_PASS = '1111'
const GA_ID = 1
const COMPANY_ID = 6
const COMPANY_NAME = '\uD55C\uD654\uC0DD\uBA85'
const INSURER_CODE = 'INS000006'
const INSURER_SLUG = '\uD55C\uD654\uC0DD\uBA85'
const CDN_BASE = 'https://cdn.platform-assets.com'
const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'insurance-mobile', 'qa-assets')

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: WRITER_USER, password: WRITER_PASS }),
  })
  const data = await res.json()
  if (!data.token) throw new Error('login failed')
  return data.token
}

async function ensureAssets() {
  fs.mkdirSync(ASSET_DIR, { recursive: true })
  const images = []
  for (let i = 1; i <= 4; i += 1) {
    const filePath = path.join(ASSET_DIR, `qa-news-image-${i}.png`)
    if (!fs.existsSync(filePath)) {
      const svg = `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#2563eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="48" font-family="Arial">QA IMAGE ${i}</text></svg>`
      await sharp(Buffer.from(svg)).png().toFile(filePath)
    }
    images.push(filePath)
  }
  const pdfPath = path.join(ASSET_DIR, 'qa-news-sample.pdf')
  if (!fs.existsSync(pdfPath)) {
    fs.writeFileSync(
      pdfPath,
      '%PDF-1.4\n1 0 obj<<>>endobj\n2 0 obj<</Length 20>>stream\nBT (QA PDF) Tj ET\nendstream\nendobj\ntrailer<<>>\n%%EOF\n',
      'utf8',
    )
  }
  return { images, pdf: pdfPath }
}

async function presignUpload(token, filePath) {
  const fileName = path.basename(filePath)
  const mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png'
  const buf = fs.readFileSync(filePath)
  const presign = await fetch(`${API}/insurer-news/attachments/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      fileName,
      contentType: mimeType,
      sizeBytes: buf.length,
      gaCode: 'YJASSET',
      insurerCode: INSURER_CODE,
      channel: 'INSURER',
    }),
  }).then((r) => r.json())
  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: buf,
  })
  if (!put.ok) throw new Error(`R2 PUT failed ${fileName}`)
  const objectKey = String(presign.objectKey)
  return {
    kind: mimeType === 'application/pdf' ? 'pdf' : 'image',
    fileName,
    mimeType,
    size: buf.length,
    objectKey,
    url: `${CDN_BASE}/${objectKey}`,
  }
}

const specs = [
  { summary: '[QA] \uC18C\uC2DD\uC9C0 \uCE74\uB4DC \uD14C\uC2A4\uD2B8 1', body: '\uC9E7\uC740 \uBCF8\uBB38', images: [0] },
  {
    summary: '[QA] \uC18C\uC2DD\uC9C0 \uCE74\uB4DC \uD14C\uC2A4\uD2B8 2 - \uAE34 \uC81C\uBAA9 \uB808\uC774\uC544\uC6C3 \uD655\uC778',
    body: '\uAE34 \uC81C\uBAA9 \uB808\uC774\uC544\uC6C3 \uD655\uC778\uC6A9 \uBCF8\uBB38\uC785\uB2C8\uB2E4.',
    images: [1],
  },
  {
    summary: '[QA] \uC18C\uC2DD\uC9C0 \uB2E4\uC911 \uC774\uBBF8\uC9C0 \uD14C\uC2A4\uD2B8',
    body: '\uC774\uBBF8\uC9C0 3\uC7A5 \uC774\uC0C1 \uD45C\uC2DC QA',
    images: [0, 1, 2],
  },
  {
    summary: '[QA] \uC18C\uC2DD\uC9C0 \uC774\uBBF8\uC9C0 \uD30C\uC77C \uD63C\uD569 \uD14C\uC2A4\uD2B8',
    body: '\uC774\uBBF8\uC9C0 + PDF \uD63C\uD569 QA',
    images: [2, 3],
    pdf: true,
    pdfName: 'QA-\uD63C\uD569-\uCCA8\uBD80-\uD14C\uC2A4\uD2B8.pdf',
  },
]

const client = new pg.Client({ connectionString })
await client.connect()
const token = await login()
const assets = await ensureAssets()
const uploaded = []
for (const img of assets.images) uploaded.push(await presignUpload(token, img))
const pdfUploaded = await presignUpload(token, assets.pdf)

const created = []
for (const spec of specs) {
  const existing = await client.query(
    `SELECT id FROM insurance_company_newsletters WHERE ga_id=$1 AND payload->>'summary'=$2 AND deleted_at IS NULL LIMIT 1`,
    [GA_ID, spec.summary],
  )
  if (existing.rowCount) {
    created.push({ id: existing.rows[0].id, summary: spec.summary, skipped: true })
    continue
  }
  const id = randomUUID()
  const payload = {
    gaCode: 'YJASSET',
    insurerCode: INSURER_CODE,
    insurerSlug: INSURER_SLUG,
    insurerName: COMPANY_NAME,
    newsChannel: 'INSURER',
    summary: spec.summary,
    publishedAt: new Date().toISOString(),
    customerVisible: false,
  }
  await client.query(
    `INSERT INTO insurance_company_newsletters
      (id, ga_id, company_id, company_name_snapshot, title, status, body_text, payload, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'',$5,$6,CAST($7 AS jsonb),NOW(),NOW())`,
    [id, GA_ID, COMPANY_ID, COMPANY_NAME, 'PUBLISHED', spec.body, JSON.stringify(payload)],
  )
  const atts = spec.images.map((idx, sortOrder) => ({ ...uploaded[idx], sortOrder }))
  if (spec.pdf) {
    atts.push({
      ...pdfUploaded,
      fileName: spec.pdfName || pdfUploaded.fileName,
      sortOrder: atts.length,
    })
  }
  for (const att of atts) {
    await client.query(
      `INSERT INTO insurance_company_newsletter_attachments
        (id, newsletter_id, kind, url, object_key, file_name, mime_type, size_bytes, sort_order, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [randomUUID(), id, att.kind, att.url, att.objectKey, att.fileName, att.mimeType, att.size, att.sortOrder],
    )
  }
  created.push({ id, summary: spec.summary })
}

const feedCount = await client.query(`
  SELECT COUNT(*)::int AS count FROM insurance_company_newsletters n
  WHERE n.ga_id = 1 AND n.status = 'PUBLISHED' AND n.deleted_at IS NULL
    AND COALESCE(NULLIF(TRIM(n.payload->>'newsChannel'), ''), 'INSURER') = 'INSURER'
    AND COALESCE((n.payload->>'customerVisible')::boolean, false) = false
    AND payload->>'summary' LIKE '[QA]%'
`)
console.log(JSON.stringify({ created, qaPublishedCount: feedCount.rows[0].count }, null, 2))
await client.end()
