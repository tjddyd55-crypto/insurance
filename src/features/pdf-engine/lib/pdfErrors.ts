/**
 * PDF 로딩/렌더 과정의 "실패 지점 라벨".
 *
 * 왜 라벨이 필요한가:
 *   PdfOverlayCanvas 는 다음 단계를 순차 실행한다.
 *     1) getDocument(data) 로 바이너리 파싱
 *     2) pdf.getPage(n) 로 페이지 객체 조회
 *     3) page.render(...) 로 캔버스 래스터화
 *   셋 중 어디서 실패했는지에 따라 대응 방법이 다르다:
 *     - parse-failed       → 스토리지/업로드 문제 (파일 자체가 깨졌거나 MIME 오응답)
 *     - page-fetch-failed  → 페이지 수 범위 오류 또는 내부 구조 손상
 *     - page-render-failed → 폰트/이미지 서브리소스 취득 실패, 메모리
 *   사용자 메시지는 동일하더라도 개발자 로그·원격 진단용으로는 반드시 구분해야 한다.
 */

export type PdfLoadErrorCode =
  | 'fetch-failed'
  | 'parse-failed'
  | 'page-fetch-failed'
  | 'page-render-failed'

export class PdfLoadError extends Error {
  readonly code: PdfLoadErrorCode
  readonly context: Record<string, unknown>

  constructor(code: PdfLoadErrorCode, context: Record<string, unknown> = {}, cause?: unknown) {
    super(code)
    this.name = 'PdfLoadError'
    this.code = code
    this.context = context
    /* ES2022 Error.cause 를 지원하지 않는 번들 타겟을 대비해 수동으로 붙인다. */
    if (cause !== undefined) {
      ;(this as { cause?: unknown }).cause = cause
    }
  }
}

/** code → 사람 친화적 메시지. 미지 code 는 일반 메시지로 안전하게 폴백. */
export function messageForPdfLoadErrorCode(
  code: PdfLoadErrorCode | 'unknown' | null | undefined,
): string {
  switch (code) {
    case 'fetch-failed':
      return '원본 PDF 를 내려받지 못했습니다. 네트워크/권한을 확인해 주세요.'
    case 'parse-failed':
      return 'PDF 파일 형식을 해석하지 못했습니다. 파일이 손상되었을 수 있습니다.'
    case 'page-fetch-failed':
      return '페이지 정보를 가져오지 못했습니다.'
    case 'page-render-failed':
      return '페이지 렌더링 중 문제가 발생했습니다.'
    default:
      return 'PDF 를 표시하지 못했습니다.'
  }
}

/** 에러 객체 → code 분류. PdfLoadError 가 아니면 'unknown'. */
export function describePdfLoadError(error: unknown): {
  code: PdfLoadErrorCode | 'unknown'
  message: string
} {
  if (error instanceof PdfLoadError) {
    return { code: error.code, message: messageForPdfLoadErrorCode(error.code) }
  }
  return { code: 'unknown', message: messageForPdfLoadErrorCode('unknown') }
}
