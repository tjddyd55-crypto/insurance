import { PDFDocument } from 'pdf-lib'

/** 상담 책자 한 권에 합칠 수 있는 최대 페이지. 원본 페이지 복사만 허용한다. */
export const PERSONAL_BINDER_EXPORT_PAGE_LIMIT = 500

/**
 * 저장된 pageSelection(1-based)을 내보낼 페이지 목록으로 확정한다.
 * null 은 자료 전체 페이지다. 화면 캡처나 클라이언트 경로를 받지 않는다.
 *
 * @param {unknown} pageSelection
 * @param {number} pageCount
 * @returns {number[]}
 */
export function resolveItemPages(pageSelection, pageCount) {
  const count = Number(pageCount)
  if (!Number.isInteger(count) || count < 1) {
    throw Object.assign(new Error('자료 페이지 수를 확인할 수 없습니다.'), { httpStatus: 409 })
  }
  if (pageSelection == null) {
    return Array.from({ length: count }, (_, index) => index + 1)
  }
  let value = pageSelection
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      value = null
    }
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw Object.assign(new Error('페이지 선택이 올바르지 않습니다.'), { httpStatus: 409 })
  }
  const pages = value.map(Number)
  if (pages.some((page) => !Number.isInteger(page) || page < 1 || page > count)) {
    throw Object.assign(new Error('선택한 페이지가 PDF 범위를 벗어났습니다.'), { httpStatus: 409 })
  }
  return pages
}

/**
 * 섹션 순서 → 자료 순서 → pageSelection 순으로 합칠 작업 목록을 만든다.
 *
 * @param {{ sections?: Array<{ sortOrder?: number, items?: Array<{ materialId: string, sortOrder?: number, pageSelection: unknown, material?: { pageCount?: number } }> }> }} detail
 */
export function planBinderExport(detail) {
  const sections = [...(detail?.sections ?? [])].sort(
    (left, right) => Number(left.sortOrder) - Number(right.sortOrder),
  )
  /** @type {Array<{ materialId: string, pages: number[] }>} */
  const jobs = []
  for (const section of sections) {
    const items = [...(section.items ?? [])].sort(
      (left, right) => Number(left.sortOrder) - Number(right.sortOrder),
    )
    for (const item of items) {
      const pages = resolveItemPages(item.pageSelection, Number(item.material?.pageCount))
      jobs.push({ materialId: String(item.materialId), pages })
    }
  }
  const total = jobs.reduce((sum, job) => sum + job.pages.length, 0)
  if (total < 1) {
    throw Object.assign(new Error('내보낼 상담 페이지가 없습니다.'), { httpStatus: 400 })
  }
  if (total > PERSONAL_BINDER_EXPORT_PAGE_LIMIT) {
    throw Object.assign(
      new Error(`한 번에 내보낼 수 있는 페이지는 ${PERSONAL_BINDER_EXPORT_PAGE_LIMIT}페이지까지입니다.`),
      { httpStatus: 400 },
    )
  }
  return jobs
}

/**
 * 원본 PDF 버퍼에서 지정 페이지만 pdf-lib copyPages 로 복사한다.
 * 뷰어 캔버스 스크린샷을 사용하지 않는다.
 *
 * @param {Array<{ buffer: Buffer | Uint8Array, pages: number[] }>} segments
 * @returns {Promise<Buffer>}
 */
export async function assembleBinderPdf(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw Object.assign(new Error('내보낼 상담 페이지가 없습니다.'), { httpStatus: 400 })
  }
  const merged = await PDFDocument.create()
  let expected = 0
  for (const segment of segments) {
    const buffer = segment?.buffer
    if (!buffer?.length || Buffer.from(buffer.subarray(0, 5)).toString('ascii') !== '%PDF-') {
      throw Object.assign(new Error('원본 PDF를 읽을 수 없습니다.'), { httpStatus: 409 })
    }
    let source
    try {
      source = await PDFDocument.load(buffer, { ignoreEncryption: false })
    } catch {
      throw Object.assign(new Error('원본 PDF를 열 수 없습니다.'), { httpStatus: 409 })
    }
    const pageCount = source.getPageCount()
    const indices = segment.pages.map((page) => {
      if (!Number.isInteger(page) || page < 1 || page > pageCount) {
        throw Object.assign(new Error('선택한 페이지가 PDF 범위를 벗어났습니다.'), { httpStatus: 409 })
      }
      return page - 1
    })
    const copied = await merged.copyPages(source, indices)
    for (const page of copied) merged.addPage(page)
    expected += copied.length
  }
  if (expected < 1 || merged.getPageCount() !== expected) {
    throw Object.assign(new Error('바인더 PDF를 만들지 못했습니다.'), { httpStatus: 500 })
  }
  const bytes = await merged.save()
  const verify = await PDFDocument.load(bytes)
  if (verify.getPageCount() !== expected) {
    throw Object.assign(new Error('바인더 PDF 검증에 실패했습니다.'), { httpStatus: 500 })
  }
  for (let index = 0; index < verify.getPageCount(); index += 1) {
    const { width, height } = verify.getPage(index).getSize()
    if (!(width > 1) || !(height > 1)) {
      throw Object.assign(new Error('빈 페이지가 포함되었습니다.'), { httpStatus: 500 })
    }
  }
  return Buffer.from(bytes)
}
