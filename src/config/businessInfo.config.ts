/**
 * 공개 페이지·법적 고지용 사업자정보 단일 진실 원천(SSOT).
 * Footer, 개인정보처리방침, 계정 삭제 안내 등에서 이 값만 참조한다.
 */
export const businessInfo = {
  businessName: '올인원솔루션',
  representativeName: '박성용',
  businessRegistrationNumber: '232-51-00991',
  businessAddress: '서울특별시 광진구 천호대로114길 39 (능동)',
  businessEmail: 'tjddyd55@naver.com',
  customerServicePhone: '010-2222-1382',
  privacyOfficerName: '박성용',
  privacyOfficerPhone: '010-2222-1382',
  /** Footer 라벨 `통신판매업 신고번호` 뒤에 붙는 값 */
  mailOrderRegistrationNumber: '제 2026-서울광진-1256 호' as string | null,
  /** 호스팅 제공자 법인명 확정 전까지 null — Footer에서 숨김 */
  hostingProviderName: null as string | null,
  businessTypes: '정보통신업 / 도매 및 소매업 / 정보통신업',
  businessItems:
    '응용 소프트웨어 개발 및 공급업 / 전자상거래 소매업 / 컴퓨터 프로그래밍 서비스업',
  copyrightYear: 2026,
} as const

export function formatPhoneForTelLink(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function formatBusinessRegistrationForFtc(number: string): string {
  return number.replace(/-/g, '')
}

/** 공정거래위원회 통신판매사업자 정보조회 (신고 전에는 검색 결과가 없을 수 있음) */
export function getFtcBusinessVerificationUrl(
  registrationNumber: string = businessInfo.businessRegistrationNumber,
): string {
  return `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${formatBusinessRegistrationForFtc(registrationNumber)}`
}
