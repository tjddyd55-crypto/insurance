import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const LOCAL_ROOT = path.join(process.cwd(), 'server-data', 'consent-storage')

function r2Credentials() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const bucket = process.env.R2_BUCKET_NAME?.trim()
  const accessKey = process.env.R2_ACCESS_KEY_ID?.trim()
  const secret = process.env.R2_SECRET_ACCESS_KEY?.trim()
  if (!accountId || !bucket || !accessKey || !secret) {
    return null
  }
  const endpoint =
    process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`
  return { accountId, bucket, accessKey, secret, endpoint }
}

let s3Client = null
function getS3() {
  if (s3Client) {
    return s3Client
  }
  const c = r2Credentials()
  if (!c) {
    return null
  }
  s3Client = new S3Client({
    region: 'auto',
    endpoint: c.endpoint,
    credentials: {
      accessKeyId: c.accessKey,
      secretAccessKey: c.secret,
    },
  })
  return s3Client
}

export function isConsentR2Enabled() {
  return Boolean(getS3() && r2Credentials())
}

/** @param {Buffer} body */
/**
 * R2 객체 삭제 (lifecycle / orphan 정리). 로컬 스토리지 모드에서는 파일 삭제 생략.
 * @param {string} key
 * @returns {Promise<boolean>} R2에서 삭제 시도했으면 true
 */
export async function r2DeleteObject(key) {
  const c = r2Credentials()
  const client = getS3()
  if (!client || !c) {
    return false
  }
  await client.send(
    new DeleteObjectCommand({
      Bucket: c.bucket,
      Key: key,
    }),
  )
  return true
}

export async function consentPutObject(key, body, contentType = 'application/octet-stream') {
  const c = r2Credentials()
  const client = getS3()
  if (client && c) {
    await client.send(
      new PutObjectCommand({
        Bucket: c.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
    return
  }
  const full = path.join(LOCAL_ROOT, key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, body)
}

export async function consentGetBuffer(key) {
  const c = r2Credentials()
  const client = getS3()
  if (client && c) {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: c.bucket,
        Key: key,
      }),
    )
    const chunks = []
    for await (const chunk of out.Body) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }
  const full = path.join(LOCAL_ROOT, key)
  return readFile(full)
}

/**
 * R2 전용 signed URL. 로컬 스토리지일 때는 null (호출측에서 JWT 다운로드 URL 사용)
 * @param {string} key
 * @param {number} expiresSec
 */
export async function consentGetSignedDownloadUrl(key, expiresSec = 900) {
  const c = r2Credentials()
  const client = getS3()
  if (!client || !c) {
    return null
  }
  const command = new GetObjectCommand({
    Bucket: c.bucket,
    Key: key,
  })
  return getSignedUrl(client, command, { expiresIn: expiresSec })
}

/** 원수사 소식 첨부 등 불변 URL에 긴 캐시 (키에 UUID 포함으로 갱신 시 신규 객체). */
export function getR2InsurerAttachmentsCacheControl() {
  const raw = process.env.R2_INSURER_ATTACHMENTS_CACHE_CONTROL?.trim()
  return raw || 'public, max-age=31536000'
}

/**
 * R2 업로드용 presigned PUT URL (원수사 소식 첨부 등).
 * CacheControl 을 넣으면 클라이언트 PUT 시 동일한 Cache-Control 헤더를 반드시 보내야 합니다.
 * @param {string} key
 * @param {string} contentType
 * @param {number} expiresSec
 * @param {{ cacheControl?: string | null }} [opts]
 */
export async function r2GetPresignedPutUrl(key, contentType, expiresSec = 900, opts = {}) {
  const c = r2Credentials()
  const client = getS3()
  if (!client || !c) {
    return null
  }
  const cacheControl =
    opts.cacheControl === undefined ? getR2InsurerAttachmentsCacheControl() : opts.cacheControl
  /** @type {import('@aws-sdk/client-s3').PutObjectCommandInput} */
  const input = {
    Bucket: c.bucket,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  }
  if (cacheControl) {
    input.CacheControl = cacheControl
  }
  const command = new PutObjectCommand(input)
  return getSignedUrl(client, command, { expiresIn: expiresSec })
}

/** 공개 CDN 베이스 (끝 슬래시 없음). R2 커스텀 도메인 또는 Workers. */
export function getR2PublicCdnBase() {
  return String(process.env.R2_PUBLIC_CDN_BASE ?? 'https://cdn.platform-assets.com').replace(/\/$/, '')
}
