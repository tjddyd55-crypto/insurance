/**
 * R2 객체 키 조합 (정책: insurance/{gaCode}/{insuranceCompany}/newsletters/{newsletterId}/...).
 * insuranceCompany segment는 내부 insurerCode 사용.
 */

export function buildInsurerNewsletterFolderPrefix(params: {
  gaCode: string
  /** 스토리지 segment — UI와 별개 */
  insurerCode: string
  newsletterId: string
}): string {
  const ga = params.gaCode.trim().toUpperCase()
  const ins = params.insurerCode.trim()
  const id = params.newsletterId.trim()
  return `insurance/${ga}/${ins}/newsletters/${id}`
}

export function buildInsurerNewsletterObjectKey(params: {
  gaCode: string
  insurerCode: string
  newsletterId: string
  /** 파일명 — 타임스탬프-역할-순번.ext 권장 */
  fileName: string
}): string {
  const base = buildInsurerNewsletterFolderPrefix({
    gaCode: params.gaCode,
    insurerCode: params.insurerCode,
    newsletterId: params.newsletterId,
  })
  const name = params.fileName.replace(/^\/+/, '').replace(/\\/g, '_')
  return `${base}/${name}`
}
