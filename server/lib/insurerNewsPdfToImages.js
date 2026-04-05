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

const execFileAsync = promisify(execFile)

const MAX_PDF_PAGES = 20

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
export async function runPdftocairoPng(pdfPath, outPrefixPath, firstPage, lastPage) {
  const bin = resolvePdftocairoPath()
  const args = [
    '-png',
    '-f',
    String(firstPage),
    '-l',
    String(lastPage),
    '-scale-to',
    '2048',
    pdfPath,
    outPrefixPath,
  ]
  try {
    await execFileAsync(bin, args, {
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const hint =
      process.platform === 'linux' ? ' 서버에 poppler-utils(pdftocairo) 설치가 필요합니다.' : ''
    throw Object.assign(new Error(`PDF 변환 실패.${hint} (${msg})`), { httpStatus: 400, cause: err })
  }
}

/**
 * @param {Buffer} pdfBuffer
 * @param {string} outDir
 * @returns {Promise<string[]>} PNG 파일 절대 경로 (페이지 순)
 */
export async function rasterizePdfToPngFiles(pdfBuffer, outDir) {
  const pageCount = await getPdfPageCount(pdfBuffer)
  if (pageCount < 1) {
    throw Object.assign(new Error('PDF 변환에 실패했습니다.'), { httpStatus: 400 })
  }
  if (pageCount > MAX_PDF_PAGES) {
    throw Object.assign(new Error(`PDF는 최대 ${MAX_PDF_PAGES}페이지까지 지원합니다.`), { httpStatus: 400 })
  }
  const pdfPath = path.join(outDir, 'input.pdf')
  await writeFile(pdfPath, pdfBuffer)
  const outBase = path.join(outDir, 'page')
  await runPdftocairoPng(pdfPath, outBase, 1, pageCount)
  const names = (await readdir(outDir))
    .filter((n) => n.toLowerCase().endsWith('.png'))
    .sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    )
  if (names.length === 0) {
    throw Object.assign(new Error('PDF 변환에 실패했습니다.'), { httpStatus: 400 })
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
  const seg = String(safeFileName ?? 'page.png')
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
    const pngPaths = await rasterizePdfToPngFiles(pdfBuffer, tmp)
    /** @type {typeof pdfAtt[]} */
    const images = []
    const base = getR2PublicCdnBase()
    let idx = 0
    for (const pngPath of pngPaths) {
      idx += 1
      const pngBuf = await readFile(pngPath)
      const fileName = `page-${idx}.png`
      const objectKey = buildInsurerNewsImageObjectKey(scope, fileName)
      await consentPutInsurerAttachment(objectKey, pngBuf, 'image/png')
      uploadedKeys.push(objectKey)
      images.push({
        id: randomUUID(),
        kind: 'image',
        url: `${base}/${objectKey}`,
        objectKey,
        fileName,
        mimeType: 'image/png',
        size: pngBuf.length,
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
    if (e && typeof e === 'object' && 'httpStatus' in e) {
      throw e
    }
    throw Object.assign(new Error('PDF 변환 실패'), { httpStatus: 400, cause: e })
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
