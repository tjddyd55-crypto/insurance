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
/** 사용자 입력 텍스트/마크는 항상 검정으로 고정한다. */
const STAMP_COLOR_BLACK = rgb(0, 0, 0)

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
    const remain = placement.width - textWidth
    /* 텍스트가 박스 폭보다 길면 정렬 오프셋을 주지 않는다.
       (center/right 오프셋이 음수가 되어 좌표가 박스 밖으로 밀리는 현상 방지) */
    if (remain <= 0) {
      x = placement.x
    } else if (placement.align === 'center') {
      x = placement.x + remain / 2
    } else if (placement.align === 'right') {
      x = placement.x + remain
    }
  }
  page.drawText(value, {
    x,
    y: placement.y,
    size: fontSize,
    font,
    color: STAMP_COLOR_BLACK,
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
      color: STAMP_COLOR_BLACK,
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
 * 체크 마커(✓) 를 PDF 좌표계에 그린다.
 *
 * 왜 텍스트 "✓" 가 아닌 라인 드로잉인가:
 *   - 번들 한글 폰트(NotoSansKR) 가 특정 체크 문자 글리프를 포함하지 않을 수 있다.
 *   - 라인으로 그리면 폰트 의존성이 사라져 어떤 환경에서도 동일 렌더가 보장된다.
 *   - 크기는 `fontSize` 를 기준 단위로 삼아 "글자 옆에 그리는 체크" 느낌을 유지한다.
 *
 * 좌표계:
 *   - PDF 는 y-up. placement.x / placement.y 는 "마커의 좌하단" 으로 간주.
 *   - width/height 가 주어지면 그 박스 중앙에 마커를 배치한다. 없으면 fontSize 정사각.
 *
 * @param {{ page: import('pdf-lib').PDFPage, placement: Placement }} ctx
 */
function stampCheckMark({ page, placement }) {
  const size = placement.fontSize && placement.fontSize > 0 ? placement.fontSize : DEFAULT_FONT_SIZE
  const boxW = placement.width && placement.width > 0 ? placement.width : size
  const boxH = placement.height && placement.height > 0 ? placement.height : size
  /* 마커 실제 크기는 박스 한 변의 85% 로 잡아 여백을 남긴다. */
  const markSize = Math.min(boxW, boxH) * 0.85
  const left = placement.x + (boxW - markSize) / 2
  const bottom = placement.y + (boxH - markSize) / 2

  /* 체크 마크 3 점: 좌측 중간 → 하단 1/3 지점 → 우측 상단. */
  const p1 = { x: left + markSize * 0.1, y: bottom + markSize * 0.5 }
  const p2 = { x: left + markSize * 0.4, y: bottom + markSize * 0.15 }
  const p3 = { x: left + markSize * 0.9, y: bottom + markSize * 0.85 }
  const thickness = Math.max(1, markSize * 0.12)
  const color = STAMP_COLOR_BLACK
  page.drawLine({ start: p1, end: p2, thickness, color })
  page.drawLine({ start: p2, end: p3, thickness, color })
}

/**
 * checkbox: "true" 일 때만 모든 placement 에 체크 마크.
 * @param {StampContext} ctx
 */
function stampCheckbox({ page, placement, value }) {
  if (value !== 'true') return
  stampCheckMark({ page, placement })
}

/**
 * radio: 선택된 옵션(value) 과 placement.optionValue 가 일치하는 것만 체크 마크.
 * 이 함수는 placement 단위로 호출되므로, 본 함수 안에서만 매칭 여부를 본다.
 * @param {StampContext} ctx
 */
function stampRadio({ page, placement, value }) {
  if (!value) return
  if (placement.optionValue !== value) return
  stampCheckMark({ page, placement })
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
    case 'checkbox':
      return stampCheckbox
    case 'radio':
      return stampRadio
    default: {
      /* 스키마에서 이미 타입이 제한돼 있으므로 도달하면 개발자 오류. */
      throw new Error(`지원하지 않는 필드 타입: ${fieldType}`)
    }
  }
}

/**
 * 필드별로 "빈 값이면 스탬프 생략" 이 가능한지 판정.
 *
 * - 텍스트 계열은 빈 문자열이면 그릴 게 없으므로 생략이 자연스럽다.
 * - checkbox 는 "true" / "false" 두 상태 모두 의미가 있다. false 때도 dispatch 에 넘겨
 *   개별 stamper 가 분기하게 한다("false 는 아무것도 안 그린다" — 같은 결과지만 책임이 명확).
 * - radio 는 value 가 비어 있으면 선택이 없으므로 스탬프 생략이 맞다.
 */
function shouldSkipEmpty(fieldType, value) {
  if (fieldType === 'checkbox') return false
  return !value
}

/** 폰트를 필요로 하는 타입인지. checkbox/radio 는 라인 드로잉만 하므로 폰트가 필요 없다. */
function needsFont(fieldType) {
  return fieldType === 'text' || fieldType === 'number' || fieldType === 'date' || fieldType === 'textarea'
}

/**
 * @param {Buffer | Uint8Array} templatePdfBytes
 * @param {FieldSpec[]} fields
 * @param {Record<string, string>} values
 * @returns {Promise<Buffer>}
 */
export async function stampPdf(templatePdfBytes, fields, values) {
  const pdfDoc = await PDFDocument.load(templatePdfBytes)
  const pages = pdfDoc.getPages()
  if (pages.length === 0) {
    throw new Error('템플릿 PDF 에 페이지가 없습니다.')
  }

  /*
   * 한글 폰트 임베드는 실제 텍스트 스탬프가 있을 때만 수행한다.
   * 이유:
   *   1) 체크박스/라디오만 있는 문서에서 글리프 0개 subset 을 만들려다 fontkit 이 터진다.
   *   2) 불필요한 폰트 임베드는 결과 파일 용량을 수 MB 키운다.
   */
  const hasTextStamp = fields.some((f) => {
    if (!needsFont(f.fieldType)) return false
    const v = values[f.fieldKey] ?? ''
    return !shouldSkipEmpty(f.fieldType, v)
  })
  const font = hasTextStamp ? await embedKoreanFont(pdfDoc) : null

  for (const field of fields) {
    const value = values[field.fieldKey] ?? ''
    if (shouldSkipEmpty(field.fieldType, value)) {
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
