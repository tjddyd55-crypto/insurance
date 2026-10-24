import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 소식지 → A4 세로(210x297mm) PDF 변환.
 *
 * 원칙
 *  - 입력은 DB 행 + R2 에서 읽은 첨부 버퍼뿐이다. 외부 URL 을 서버가 요청하지 않는다 (SSRF 없음).
 *  - 논리 순서: 머리글(회사·게시일) → 제목/요약 → 본문 → 링크 → 첨부(sort_order 순).
 *  - 이미지는 비율을 유지하며 본문 폭에 맞춘다. 남은 공간에 안 들어가면 다음 페이지로 넘긴다.
 *  - PDF 첨부는 각 페이지를 A4 세로에 비율 유지로 배치한다.
 *  - 넣을 수 없는 콘텐츠는 PDF 안에 안내 문구를 남기고 warnings 로도 돌려준다 (silent success 금지).
 */

const FONT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fonts/newsletter/NotoSansKR-Regular-compact.ttf')
let fontBytesCache = null
async function loadKoreanFontBytes() {
  if (!fontBytesCache) fontBytesCache = await readFile(FONT_PATH)
  return fontBytesCache
}

export const A4_WIDTH_PT = 595.28
export const A4_HEIGHT_PT = 841.89
const MARGIN = 42
const CONTENT_W = A4_WIDTH_PT - MARGIN * 2
const BODY_SIZE = 11
const BODY_LEADING = 17.5
const MAX_TOTAL_PAGES = 120
const MAX_IMAGE_EDGE_PX = 2000

const COLOR_TEXT = rgb(0.13, 0.13, 0.15)
const COLOR_MUTED = rgb(0.42, 0.44, 0.48)
const COLOR_RULE = rgb(0.85, 0.86, 0.88)
const COLOR_NOTICE = rgb(0.55, 0.33, 0.05)

/**
 * 공백 단위로 줄바꿈하되, 한 단어가 폭을 넘으면 글자 단위로 자른다.
 * @param {string} text
 * @param {import('pdf-lib').PDFFont} font
 * @param {number} size
 * @param {number} maxWidth
 */
export function wrapTextLines(text, font, size, maxWidth) {
  const out = []
  const paragraphs = String(text ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      out.push('')
      continue
    }
    const tokens = paragraph.split(/(\s+)/).filter((t) => t.length > 0)
    let line = ''
    const width = (s) => font.widthOfTextAtSize(s, size)
    for (const token of tokens) {
      const candidate = line + token
      if (width(candidate) <= maxWidth) {
        line = candidate
        continue
      }
      if (line.trim() !== '') {
        out.push(line.trimEnd())
        line = ''
      }
      const piece = /^\s+$/.test(token) ? '' : token
      if (width(piece) <= maxWidth) {
        line = piece
        continue
      }
      for (const ch of Array.from(piece)) {
        if (width(line + ch) > maxWidth && line !== '') {
          out.push(line)
          line = ch
        } else {
          line += ch
        }
      }
    }
    out.push(line.trimEnd())
  }
  return out
}

/** 폰트에 없는 글리프(이모지 등)는 pdf-lib 가 예외를 내므로 대체 문자로 바꾼다. */
function sanitizeForFont(text, font) {
  const chars = Array.from(String(text ?? ''))
  const supported = new Set(font.getCharacterSet ? font.getCharacterSet() : [])
  if (supported.size === 0) return chars.join('')
  return chars
    .map((ch) => {
      if (ch === '\n' || ch === '\t' || ch === ' ') return ch
      const cp = ch.codePointAt(0)
      return supported.has(cp) ? ch : '□'
    })
    .join('')
}

class A4Writer {
  /** @param {PDFDocument} doc @param {import('pdf-lib').PDFFont} font */
  constructor(doc, font) {
    this.doc = doc
    this.font = font
    this.page = null
    this.y = 0
  }

  newPage() {
    if (this.doc.getPageCount() >= MAX_TOTAL_PAGES) {
      throw Object.assign(new Error('소식지가 너무 길어 PDF로 변환할 수 없습니다.'), { httpStatus: 422 })
    }
    this.page = this.doc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT])
    this.y = A4_HEIGHT_PT - MARGIN
  }

  ensure(height) {
    if (!this.page || this.y - height < MARGIN) this.newPage()
  }

  remaining() {
    return this.page ? this.y - MARGIN : 0
  }

  text(text, { size = BODY_SIZE, leading = BODY_LEADING, color = COLOR_TEXT } = {}) {
    const clean = sanitizeForFont(text, this.font)
    for (const line of wrapTextLines(clean, this.font, size, CONTENT_W)) {
      this.ensure(leading)
      if (line !== '') {
        this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font: this.font, color })
      }
      this.y -= leading
    }
  }

  gap(h) {
    if (this.page) this.y -= h
  }

  rule() {
    this.ensure(10)
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 4 },
      end: { x: A4_WIDTH_PT - MARGIN, y: this.y - 4 },
      thickness: 0.7,
      color: COLOR_RULE,
    })
    this.y -= 12
  }

  /** @param {import('pdf-lib').PDFImage} img @param {string} caption */
  image(img, caption) {
    const captionH = caption ? 16 : 0
    const fullH = A4_HEIGHT_PT - MARGIN * 2 - captionH
    let w = CONTENT_W
    let h = (img.height / img.width) * w
    if (h > fullH) {
      h = fullH
      w = (img.width / img.height) * h
    }
    // 남은 공간이 넉넉하면(본문 높이 40% 이상) 폭 60%까지 비율 유지 축소해 같은 페이지에 둔다.
    const room = this.remaining() - captionH
    if (this.page && room < h && room >= fullH * 0.4) {
      const shrink = room / h
      if (w * shrink >= CONTENT_W * 0.6) {
        w *= shrink
        h *= shrink
      }
    }
    // 캡션과 이미지가 분리되지 않도록 함께 들어갈 공간을 확보한다.
    if (!this.page || this.remaining() < h + captionH) this.newPage()
    const x = MARGIN + (CONTENT_W - w) / 2
    this.page.drawImage(img, { x, y: this.y - h, width: w, height: h })
    this.y -= h
    if (caption) {
      const size = 8.5
      const line = wrapTextLines(sanitizeForFont(caption, this.font), this.font, size, CONTENT_W)[0] ?? ''
      this.page.drawText(line, { x: MARGIN, y: this.y - 12, size, font: this.font, color: COLOR_MUTED })
      this.y -= captionH
    }
    this.y -= 10
  }
}

async function normalizeImageForPdf(bytes) {
  const pipeline = sharp(bytes, { failOn: 'none', limitInputPixels: 80_000_000 }).rotate()
  const meta = await pipeline.metadata()
  const resized = pipeline.resize({
    width: MAX_IMAGE_EDGE_PX,
    height: MAX_IMAGE_EDGE_PX,
    fit: 'inside',
    withoutEnlargement: true,
  })
  if (meta.hasAlpha) {
    return { kind: 'png', bytes: await resized.png({ compressionLevel: 9 }).toBuffer() }
  }
  return { kind: 'jpg', bytes: await resized.jpeg({ quality: 85, mozjpeg: true }).toBuffer() }
}

function formatKstDate(value) {
  const d = value ? new Date(value) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  const k = new Date(d.getTime() + 9 * 3600 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${k.getUTCFullYear()}.${p(k.getUTCMonth() + 1)}.${p(k.getUTCDate())}`
}

function isPdfAttachment(att) {
  const mime = String(att.mime_type ?? '').toLowerCase()
  return mime === 'application/pdf' || String(att.file_name ?? '').toLowerCase().endsWith('.pdf')
}

function isImageAttachment(att) {
  const mime = String(att.mime_type ?? '').toLowerCase()
  if (mime.startsWith('image/')) return true
  return String(att.kind ?? '').toLowerCase() === 'image'
}

/**
 * @param {object} input
 * @param {{ title?: string, summary?: string, bodyText?: string, insurerName?: string, publishedAt?: string|Date|null }} input.newsletter
 * @param {{ url?: string, title?: string }|null} [input.linkPreview]
 * @param {Array<{ row: object, buffer: Buffer|null, error?: string }>} input.attachments sort_order 순
 * @returns {Promise<{ buffer: Buffer, pageCount: number, warnings: string[] }>}
 */
export async function buildNewsletterA4Pdf({ newsletter, linkPreview = null, attachments = [] }) {
  const warnings = []
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  // 경량 폰트(사전 subset, glyf, GSUB 없음)를 통째로 임베드한다. fontkit 런타임 subset 은 glyf 를 손상시키고,
  // calt/locl 대체 글리프는 /W 폭 표에서 빠져 간격이 깨지므로 둘 다 끈다.
  const font = await doc.embedFont(await loadKoreanFontBytes(), { subset: false, features: { calt: false, locl: false } })
  const fixedDate = newsletter.publishedAt ? new Date(newsletter.publishedAt) : new Date(0)
  const heading = String(newsletter.title || newsletter.summary || '소식지').trim()
  doc.setTitle(heading.slice(0, 200))
  doc.setProducer('onefc newsletter A4')
  doc.setCreator('onefc')
  if (!Number.isNaN(fixedDate.getTime())) {
    doc.setCreationDate(fixedDate)
    doc.setModificationDate(fixedDate)
  }

  const w = new A4Writer(doc, font)
  w.newPage()
  const meta = [newsletter.insurerName, formatKstDate(newsletter.publishedAt)].filter(Boolean).join(' · ')
  if (meta) w.text(meta, { size: 9.5, leading: 14, color: COLOR_MUTED })
  w.gap(2)
  w.text(heading, { size: 16, leading: 23 })
  w.rule()

  const body = String(newsletter.bodyText ?? '').trim()
  if (body && body !== heading) {
    w.text(body)
    w.gap(8)
  }

  if (linkPreview?.url) {
    w.text(`링크${linkPreview.title ? ` · ${linkPreview.title}` : ''}`, { size: 9.5, leading: 14, color: COLOR_MUTED })
    w.text(String(linkPreview.url), { size: 9.5, leading: 14, color: rgb(0.1, 0.32, 0.7) })
    w.text('(링크·영상은 PDF에서 재생되지 않습니다. 위 주소로 확인해 주세요.)', {
      size: 8.5,
      leading: 13,
      color: COLOR_MUTED,
    })
    w.gap(8)
  }

  for (const entry of attachments) {
    const att = entry.row
    const name = String(att.file_name ?? '').trim() || '첨부'
    if (!entry.buffer) {
      warnings.push(`${name}: 첨부를 불러오지 못해 안내 문구로 대체했습니다.`)
      w.text(`[첨부를 불러오지 못했습니다: ${name}]`, { size: 9.5, leading: 14, color: COLOR_NOTICE })
      continue
    }
    if (isPdfAttachment(att)) {
      let src
      try {
        src = await PDFDocument.load(entry.buffer, { ignoreEncryption: false })
      } catch {
        warnings.push(`${name}: 열 수 없는 PDF(암호/손상)라 안내 문구로 대체했습니다.`)
        w.text(`[PDF 첨부를 포함할 수 없습니다: ${name}]`, { size: 9.5, leading: 14, color: COLOR_NOTICE })
        continue
      }
      for (const srcPage of src.getPages()) {
        w.newPage()
        if (!srcPage.node.Contents()) {
          // 내용 스트림이 없는 빈 페이지는 빈 A4 페이지로 유지한다 (순서 보존).
          w.y = MARGIN
          continue
        }
        const ep = await doc.embedPage(srcPage)
        const scale = Math.min(CONTENT_W / ep.width, (A4_HEIGHT_PT - MARGIN * 2) / ep.height)
        const pw = ep.width * scale
        const ph = ep.height * scale
        w.page.drawPage(ep, {
          x: (A4_WIDTH_PT - pw) / 2,
          y: (A4_HEIGHT_PT - ph) / 2,
          width: pw,
          height: ph,
        })
        w.y = MARGIN
      }
      continue
    }
    if (isImageAttachment(att)) {
      try {
        const norm = await normalizeImageForPdf(entry.buffer)
        const img = norm.kind === 'png' ? await doc.embedPng(norm.bytes) : await doc.embedJpg(norm.bytes)
        w.image(img, '')
      } catch {
        warnings.push(`${name}: 이미지 형식을 변환하지 못해 안내 문구로 대체했습니다.`)
        w.text(`[이미지를 포함할 수 없습니다: ${name}]`, { size: 9.5, leading: 14, color: COLOR_NOTICE })
      }
      continue
    }
    warnings.push(`${name}: 이 형식은 PDF에 포함할 수 없어 파일명으로 대체했습니다.`)
    w.text(`[PDF에 포함할 수 없는 첨부: ${name}]`, { size: 9.5, leading: 14, color: COLOR_NOTICE })
  }

  const bytes = Buffer.from(await doc.save({ useObjectStreams: true }))
  return { buffer: bytes, pageCount: doc.getPageCount(), warnings }
}

/**
 * 생성 결과 검증: PDF 시그니처, 다시 열리는지, 모든 페이지가 A4 세로인지.
 * @param {Buffer} buffer
 */
export async function validateNewsletterA4Pdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw Object.assign(new Error('생성된 PDF 형식이 올바르지 않습니다.'), { httpStatus: 500 })
  }
  const doc = await PDFDocument.load(buffer)
  const pages = doc.getPages()
  if (pages.length < 1) {
    throw Object.assign(new Error('생성된 PDF에 페이지가 없습니다.'), { httpStatus: 500 })
  }
  for (const p of pages) {
    const { width, height } = p.getSize()
    if (Math.abs(width - A4_WIDTH_PT) > 1 || Math.abs(height - A4_HEIGHT_PT) > 1) {
      throw Object.assign(new Error('생성된 PDF가 A4 규격이 아닙니다.'), { httpStatus: 500 })
    }
  }
  return pages.length
}
