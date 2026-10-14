/**
 * 일정 관리(PC) 고객 상세 팝업 전용 "임베드 표시".
 *
 * 일정 관리 팝업은 기존 고객 상세 화면(`/customers/:id/...`, 좌측 고객 정보 + 우측 탭 전체)을
 * 같은 출처 iframe 으로 그대로 띄운다(라우트 기반 탭이라 같은 화면을 다시 만들지 않기 위함).
 * 이 모듈은 **iframe 안에서, 첫 주소에 `embed=customer` 가 있을 때만** 문서에 표시 class 를 붙여
 * 상단 메뉴·고객 목록·검색을 CSS 로 숨긴다. 일반 탭/창(top window)에서는 아무 일도 하지 않는다.
 * 앱 안 이동(탭 전환)으로 쿼리가 사라져도 iframe 문서가 살아 있는 동안 유지된다.
 */
import './customer-embed.css'

export const CUSTOMER_EMBED_QUERY_KEY = 'embed'
export const CUSTOMER_EMBED_QUERY_VALUE = 'customer'
export const CUSTOMER_EMBED_CLASS = 'onefc-embed-customer'

export function shouldEnableCustomerEmbed(win: Pick<Window, 'self' | 'top' | 'location'>): boolean {
  let framed = false
  try {
    framed = win.self !== win.top
  } catch {
    framed = true
  }
  if (!framed) return false
  return new URLSearchParams(win.location.search).get(CUSTOMER_EMBED_QUERY_KEY) === CUSTOMER_EMBED_QUERY_VALUE
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && shouldEnableCustomerEmbed(window)) {
  document.documentElement.classList.add(CUSTOMER_EMBED_CLASS)
}
