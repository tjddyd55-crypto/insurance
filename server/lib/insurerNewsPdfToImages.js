import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import {
  consentGetBuffer,
  consentPutInsurerAttachment,
  getR2PublicCdnBase,
  r2DeleteObject,
} from './consentStorage.js'
import { INSURER_R2_ACTIVE_CATEGORY } from './insurerR2Layout.js'
import { insurerNewsLog } from './logger.js'

const execFileAsync = promisify(execFile)

const MAX_PDF_PAGES = 20

/** API 에서 `USER_PDF_PREP_FAILURE_MESSAGE` 로 매핑할 때 사용 (첨부 검증 400 과 구분) */
function asPdfPrepError(err, httpStatus = 400) {
  return Object.assign(err instanceof Error ? err : new Error(String(err)), {
    httpStatus,
    pdfPrepFailure: true,
  })
}

/** 모바일 스크롤 기준 폭. `INSURER_NEWS_PDF_SCALE_TO` 로 덮어쓰기 가능 */
const DEFAULT_SCALE_TO = 1080

/** 기본 60초. 예: 10~20초 보호가 필요하면 `INSURER_NEWS_PDF_CONVERT_TIMEOUT_MS=20000` */
const DEFAULT_CONVERT_TIMEOUT_MS = 60_000

const JPEG_QUALITY = 80

const RASTER_FILE_RE = /\.(jpe?g|png)$/i

/**
 * Linux/서버: PATH 의 pdftocairo (poppler-utils).
 * Windows: `INSURER_NEWS_POPPLER_BIN` 또는 pdf-poppler 번들 경로 (pdf-poppler 의 index.js 는 Linux 에서 프로세스 종료하므로 require 하지 않음).
 */
export function resolvePdftocairoPath() {
  const envDir = process.env.INSURER_NEWS_POPPLER_BIN?.trim()
  if (envDir) {
    return path.join(envDir, process.platform === 'win32' ? 'pdftocairo.exe' : 'pdftocairo')
  }
  if (process.platform === 'win32') {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const bundled = path.resolve(
      here,
      '..',
      '..',
      'node_modules',
      'pdf-poppler',
      'lib',
      'win',
      'poppler-0.51',
      'bin',
      'pdftocairo.exe',
    )
    return bundled
  }
  return 'pdftocairo'
}

function resolveScaleTo() {
  const raw = process.env.INSURER_NEWS_PDF_SCALE_TO?.trim()
  if (raw) {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 320 && n <= 4096) {
      return Math.floor(n)
    }
  }
  return DEFAULT_SCALE_TO
}

function resolvePdfConvertTimeoutMs() {
  const raw = process.env.INSURER_NEWS_PDF_CONVERT_TIMEOUT_MS?.trim()
  if (raw) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) {
      return Math.min(Math.floor(n), 600_000)
    }
  }
  return DEFAULT_CONVERT_TIMEOUT_MS
}

/**
 * pdftocairo 산출물(`page-01.jpg` 등) 파일명 → 페이지 번호 (없으면 0).
 * @param {string} filename
 */
function pageNumberFromRasterName(filename) {
  const base = path.basename(filename)
  const dashed = base.match(/-(\d+)\.(?:jpe?g|png)$/i)
  if (dashed) {
    return Number(dashed[1])
  }
  const plain = base.match(/^(\d+)\.(?:jpe?g|png)$/i)
  if (plain) {
    return Number(plain[1])
  }
  return 0
}

/**
 * @param {string[]} names
 */
function sortRasterFileNames(names) {
  return [...names].sort((a, b) => {
    const na = pageNumberFromRasterName(a)
    const nb = pageNumberFromRasterName(b)
    if (na !== nb) {
      return na - nb
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/**
 * @param {Buffer} buffer
 */
export async function getPdfPageCount(buffer) {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true }).catch(() => null)
  if (!doc) {
    return 0
  }
  return doc.getPageCount()
}

/**
 * @param {string} pdfPath
 * @param {string} outPrefixPath 디렉터리 + 파일 prefix (확장자 없음)
 * @param {number} firstPage 1-base
 * @param {number} lastPage inclusive
 */
async function runPdftocairoJpeg(pdfPath, outPrefixPath, firstPage, lastPage) {
  const bin = resolvePdftocairoPath()
  const scaleTo = resolveScaleTo()
  const args = [
    '-jpeg',
    '-jpegopt',
    `quality=${JPEG_QUALITY}`,
    '-f',
    String(firstPage),
    '-l',
    String(lastPage),
    '-scale-to',
    String(scaleTo),
    pdfPath,
    outPrefixPath,
  ]
  try {
    await execFileAsync(bin, args, {
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      timeout: resolvePdfConvertTimeoutMs(),
      killSignal: 'SIGKILL',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const hint =
      process.platform === 'linux' ? ' 서버에 poppler-utils(pdftocairo) 설치가 필요합니다.' : ''
    const convErr = asPdfPrepError(new Error(`PDF 변환 실패.${hint} (${msg})`), 400)
    convErr.cause = err
    throw convErr
  }
}

/**
 * @param {Buffer} pdfBuffer
 * @param {string} outDir
 * @returns {Promise<string[]>} JPEG 파일 절대 경로 (페이지 순)
 */
async function rasterizePdfToJpegFiles(pdfBuffer, outDir) {
  const pageCount = await getPdfPageCount(pdfBuffer)
  if (pageCount < 1) {
    throw asPdfPrepError(new Error('PDF 변환에 실패했습니다.'), 400)
  }
  if (pageCount > MAX_PDF_PAGES) {
    throw asPdfPrepError(new Error(`PDF는 최대 ${MAX_PDF_PAGES}페이지까지 지원합니다.`), 400)
  }
  const pdfPath = path.join(outDir, 'input.pdf')
  await writeFile(pdfPath, pdfBuffer)
  const outBase = path.join(outDir, 'page')
  await runPdftocairoJpeg(pdfPath, outBase, 1, pageCount)
  const names = sortRasterFileNames((await readdir(outDir)).filter((n) => RASTER_FILE_RE.test(n)))
  if (names.length === 0) {
    throw asPdfPrepError(new Error('PDF 변환에 실패했습니다.'), 400)
  }
  return names.map((n) => path.join(outDir, n))
}

/**
 * presign 과 동일한 object key 패턴
 * @param {{ gaPath: string, companySlug: string }} scope
 * @param {string} safeFileName
 */
export function buildInsurerNewsImageObjectKey(scope, safeFileName) {
  const ym = new Date().toISOString().slice(0, 7)
  const seg = String(safeFileName ?? 'page.jpg')
    .replace(/[^\w.\-()\u3131-\u318e\uac00-\ud7a3]/g, '_')
    .slice(0, 120)
  return `insurer/${scope.gaPath}/${INSURER_R2_ACTIVE_CATEGORY}/${ym}/${scope.companySlug}/${randomUUID()}-${seg}`
}

/**
 * 단일 PDF 첨부 → 이미지 첨부 목록. R2 업로드까지 수행. 원본 PDF 객체는 삭제하지 않음.
 * @param {{ id: string, kind: string, url: string, objectKey: string, fileName: string, mimeType: string, size: number }} pdfAtt
 * @param {{ gaPath: string, companySlug: string }} scope
 */
export async function convertPdfAttachmentToImages(pdfAtt, scope) {
  const uploadedKeys = []
  let tmp = null
  try {
    const pdfBuffer = await consentGetBuffer(pdfAtt.objectKey)
    tmp = await mkdtemp(path.join(os.tmpdir(), 'insurer-news-pdf-'))
    const rasterPaths = await rasterizePdfToJpegFiles(pdfBuffer, tmp)
    /** @type {typeof pdfAtt[]} */
    const images = []
    const base = getR2PublicCdnBase()
    let idx = 0
    for (const rasterPath of rasterPaths) {
      idx += 1
      const rasterBuf = await readFile(rasterPath)
      const fileName = `page-${idx}.jpg`
      const objectKey = buildInsurerNewsImageObjectKey(scope, fileName)
      await consentPutInsurerAttachment(objectKey, rasterBuf, 'image/jpeg')
      uploadedKeys.push(objectKey)
      images.push({
        id: randomUUID(),
        kind: 'image',
        url: `${base}/${objectKey}`,
        objectKey,
        fileName,
        mimeType: 'image/jpeg',
        size: rasterBuf.length,
      })
    }
    if (process.env.NODE_ENV !== 'production') {
      insurerNewsLog.info({
        event: 'pdf-converted-pages',
        pageCount: images.length,
        objectKeys: images.map((i) => i.objectKey),
      })
    }
    return { images, pdfObjectKey: pdfAtt.objectKey }
  } catch (e) {
    for (const k of uploadedKeys) {
      try {
        await r2DeleteObject(k)
      } catch {
        /* ignore */
      }
    }
    insurerNewsLog.error({
      event: 'pdf-convert-failed',
      pdfObjectKey: pdfAtt.objectKey,
      err: e instanceof Error ? e.message : String(e),
    })
    if (e && typeof e === 'object' && 'httpStatus' in e) {
      throw e
    }
    throw asPdfPrepError(new Error('PDF 변환 실패'), 400)
  } finally {
    if (tmp) {
      try {
        await rm(tmp, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * 첨부 배열에서 PDF 를 페이지 이미지로 펼침(순서 유지).
 * @param {Awaited<ReturnType<any>>[]} normalized assertAttachmentInput 결과 배열
 * @param {{ gaPath: string, companySlug: string }} scope
 */
export async function expandPdfAttachmentsForNewsletter(normalized, scope) {
  /** @type {typeof normalized} */
  const out = []
  const pdfKeysToDeleteAfterCommit = []
  for (const a of normalized) {
    if (a.mimeType !== 'application/pdf') {
      out.push(a)
      continue
    }
    const { images, pdfObjectKey } = await convertPdfAttachmentToImages(a, scope)
    out.push(...images)
    pdfKeysToDeleteAfterCommit.push(pdfObjectKey)
  }
  return { attachments: out, pdfKeysToDeleteAfterCommit }
}
