/**
 * 원본 PDF 바이트 + 필드 정의 + 입력값 → 스탬핑된 PDF 바이트.
 *
 * 설계 원칙:
 *   - 순수 함수로 설계(입력만으로 출력이 결정). DB/HTTP/파일시스템에 의존하지 않는다.
 *     호출측(API 핸들러)이 원본 바이트와 필드 정의를 준비해서 넘긴다.
 *   - 좌표계는 PDF user space(원점 좌하단, pt) 로 고정 — DB 에 저장된 형식과 일치.
 *   - textarea 는 placement.width 가 있으면 단어 단위 줄바꿈, 없으면 개행 문자만 존중.
 *
 * 확장 포인트:
 *   - Phase 2 의 radio/checkbox 는 "placement 별 optionValue 매칭" 만 추가하면 된다.
 *     현재 구조에서 type 별 stamper 분기를 한 곳(dispatchStamp) 에 모아둔 이유.
 *   - 체크박스 마크 이미지(PNG) 는 별도 모듈(markAssetProvider) 로 분리 예정.
 */

import { PDFDocument, rgb } from 'pdf-lib'
import { embedKoreanFont } from './fontProvider.js'

/** @typedef {import('../schema/fieldSpec.js').FieldSpec} FieldSpec */
/** @typedef {import('../schema/fieldSpec.js').FieldSpec['placements'][number]} Placement */

const DEFAULT_FONT_SIZE = 11

/**
 * @typedef {{
 *   page: import('pdf-lib').PDFPage,
 *   font: import('pdf-lib').PDFFont,
 *   placement: Placement,
 *   value: string,
 * }} StampContext
 */

/**
 * 단일 라인 텍스트 스탬핑. 정렬(width 존재 시) 반영.
 * @param {StampContext} ctx
 */
function stampSingleLine({ page, font, placement, value }) {
  if (!value) return
  const fontSize = placement.fontSize ?? DEFAULT_FONT_SIZE
  const textWidth = font.widthOfTextAtSize(value, fontSize)
  let x = placement.x
  if (placement.width && placement.width > 0) {
    if (placement.align === 'center') {
      x = placement.x + (placement.width - textWidth) / 2
    } else if (placement.align === 'right') {
      x = placement.x + (placement.width - textWidth)
    }
  }
  page.drawText(value, {
    x,
    y: placement.y,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  })
}

/**
 * width 가 있으면 단어 단위로 줄바꿈, 없으면 개행 문자만 존중.
 * height 가 있으면 넘치는 라인은 무시.
 * @param {StampContext} ctx
 */
function stampMultiLine({ page, font, placement, value }) {
  if (!value) return
  const fontSize = placement.fontSize ?? DEFAULT_FONT_SIZE
  const lineHeight = fontSize * 1.35
  const maxWidth = placement.width && placement.width > 0 ? placement.width : null
  const maxLines =
    placement.height && placement.height > 0 ? Math.max(1, Math.floor(placement.height / lineHeight)) : null

  const lines = wrapText(value, font, fontSize, maxWidth)
  const drawLines = maxLines != null ? lines.slice(0, maxLines) : lines

  drawLines.forEach((line, idx) => {
    page.drawText(line, {
      x: placement.x,
      y: placement.y - idx * lineHeight,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    })
  })
}

/**
 * @param {string} value
 * @param {import('pdf-lib').PDFFont} font
 * @param {number} fontSize
 * @param {number | null} maxWidth
 */
function wrapText(value, font, fontSize, maxWidth) {
  const result = []
  const paragraphs = value.split(/\r?\n/)
  for (const para of paragraphs) {
    if (maxWidth == null) {
      result.push(para)
      continue
    }
    if (para === '') {
      result.push('')
      continue
    }
    const words = para.split(/(\s+)/).filter((w) => w.length > 0)
    let line = ''
    for (const word of words) {
      const next = line + word
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth || line === '') {
        line = next
      } else {
        result.push(line.trimEnd())
        line = word.trimStart()
      }
    }
    if (line) {
      result.push(line.trimEnd())
    }
  }
  return result
}

/**
 * 타입별 스탬핑 전략 분기. 새 타입 추가 시 이 맵만 늘리면 된다.
 *
 * @param {FieldSpec['fieldType']} fieldType
 * @returns {(ctx: StampContext) => void}
 */
function dispatchStamp(fieldType) {
  switch (fieldType) {
    case 'textarea':
      return stampMultiLine
    case 'text':
    case 'number':
    case 'date':
      return stampSingleLine
    default: {
      /* 스키마에서 이미 타입이 제한돼 있으므로 도달하면 개발자 오류. */
      throw new Error(`지원하지 않는 필드 타입: ${fieldType}`)
    }
  }
}

/**
 * @param {Buffer | Uint8Array} templatePdfBytes
 * @param {FieldSpec[]} fields
 * @param {Record<string, string>} values
 * @returns {Promise<Buffer>}
 */
export async function stampPdf(templatePdfBytes, fields, values) {
  const pdfDoc = await PDFDocument.load(templatePdfBytes)
  const font = await embedKoreanFont(pdfDoc)
  const pages = pdfDoc.getPages()
  if (pages.length === 0) {
    throw new Error('템플릿 PDF 에 페이지가 없습니다.')
  }

  for (const field of fields) {
    const value = values[field.fieldKey] ?? ''
    if (!value) {
      /* 비필수 필드는 빈 값 허용 → 스탬프 생략. */
      continue
    }
    const stamp = dispatchStamp(field.fieldType)
    for (const placement of field.placements) {
      const page = pages[placement.page]
      if (!page) {
        /* 잘못된 페이지 인덱스는 해당 placement 만 건너뛴다(데이터 보호). */
        continue
      }
      stamp({ page, font, placement, value })
    }
  }

  const out = await pdfDoc.save()
  return Buffer.from(out)
}
