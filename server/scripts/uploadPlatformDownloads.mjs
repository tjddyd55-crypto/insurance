#!/usr/bin/env node
/**
 * PC 설치 파일·모바일 APK를 R2 platform-assets public downloads 경로에 업로드한다.
 *
 * 사용 예:
 *   node server/scripts/uploadPlatformDownloads.mjs --desktop release/InsuranceApp Setup 1.0.7.exe
 *   node server/scripts/uploadPlatformDownloads.mjs --mobile path/to/app-release.apk --version 1.0.2
 *
 * 업로드 key (고객 파일 SSOT와 분리):
 *   insurance/public/downloads/desktop/latest/insurance-desktop-latest.exe
 *   insurance/public/downloads/desktop/{version}/insurance-desktop-{version}.exe
 *   insurance/public/downloads/mobile/latest/insurance-mobile-latest.apk
 *   insurance/public/downloads/mobile/{version}/insurance-mobile-{version}.apk
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { PLATFORM_DOWNLOAD_CDN_KEYS } from '../lib/platformDownloadUrls.js'

function parseArgs(argv) {
  const args = { desktop: '', mobile: '', version: '' }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--desktop') {
      args.desktop = argv[++i] ?? ''
    } else if (token === '--mobile') {
      args.mobile = argv[++i] ?? ''
    } else if (token === '--version') {
      args.version = argv[++i] ?? ''
    }
  }
  return args
}

function r2Client() {
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    (process.env.R2_ACCOUNT_ID?.trim()
      ? `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`
      : '')
  const bucket = process.env.R2_BUCKET_NAME?.trim() || process.env.R2_BUCKET?.trim() || 'platform-assets'
  const accessKey = process.env.R2_ACCESS_KEY_ID?.trim() || process.env.R2_ACCESS_KEY?.trim()
  const secret = process.env.R2_SECRET_ACCESS_KEY?.trim() || process.env.R2_SECRET_KEY?.trim()
  if (!endpoint || !accessKey || !secret || !bucket) {
    throw new Error('R2 credentials missing (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)')
  }
  return {
    bucket,
    client: new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId: accessKey, secretAccessKey: secret },
    }),
  }
}

async function putFile(client, bucket, key, filePath, contentType) {
  const body = await readFile(filePath)
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=300',
    }),
  )
  console.log(`uploaded: ${key} (${body.length} bytes)`)
}

async function main() {
  const { desktop, mobile, version } = parseArgs(process.argv)
  if (!desktop && !mobile) {
    console.error('Provide --desktop <exe> and/or --mobile <apk>')
    process.exit(1)
  }

  const { client, bucket } = r2Client()

  if (desktop) {
    const abs = path.resolve(desktop)
    await putFile(client, bucket, PLATFORM_DOWNLOAD_CDN_KEYS.desktopLatest, abs, 'application/octet-stream')
    if (version) {
      const versionKey = `insurance/public/downloads/desktop/${version}/insurance-desktop-${version}.exe`
      await putFile(client, bucket, versionKey, abs, 'application/octet-stream')
    }
  }

  if (mobile) {
    const abs = path.resolve(mobile)
    await putFile(client, bucket, PLATFORM_DOWNLOAD_CDN_KEYS.mobileLatest, abs, 'application/vnd.android.package-archive')
    if (version) {
      const versionKey = `insurance/public/downloads/mobile/${version}/insurance-mobile-${version}.apk`
      await putFile(client, bucket, versionKey, abs, 'application/vnd.android.package-archive')
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
