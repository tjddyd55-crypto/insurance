export const COVERAGE_SHARE_WEB_TEXT =
  '보장 상담자료를 보내드립니다. 아래 링크에서 기존 보장과 제안 보장을 확인하실 수 있습니다.'

export function buildCoverageShareWebSharePayload(input: {
  shareUrl: string
  customerName?: string | null
  title?: string
}): { title: string; text: string; url: string } {
  const title = input.title?.trim() || '보장 시뮬레이션'
  const nameLine =
    input.customerName?.trim() ? `${input.customerName.trim()} 고객님께 보내는 ` : ''
  return {
    title,
    text: `${nameLine}${COVERAGE_SHARE_WEB_TEXT}`,
    url: input.shareUrl,
  }
}
