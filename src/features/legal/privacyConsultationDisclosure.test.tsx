import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY } from '../public-advisor/consultation/consultationPrivacyPolicy'

vi.mock('./useLegalPageNavigation', () => ({
  useLegalPageNavigation: () => ({ goBack: () => {}, close: () => {} }),
}))

import PrivacyPolicyPage from './PrivacyPolicyPage'

function render(node: React.ReactNode) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={['/privacy']}>{node}</MemoryRouter>)
    .replace(/<!-- -->/g, '')
    .replace(/\s+/g, ' ')
}

describe('공개 모바일 명함 상담 신청 고지', () => {
  it('기존 조항을 유지한 채 제2조에 상담 신청 수집·이용을 추가한다', () => {
    const html = render(<PrivacyPolicyPage />)
    expect(html).toContain('시행일 2026년 10월 23일 · 개정일 2026년 10월 16일')
    expect(html).toContain('2026년 10월 16일에 공지하며 2026년 10월 23일부터 시행합니다')
    expect(html).toContain('도입·이용 문의(소개 페이지)')
    expect(html).toContain('온라인 문의 접수가 제한됩니다')
    expect(html).toContain('제4조 개인정보의 제3자 제공')
    expect(html).toContain('회사는 정보주체의 동의가 있거나 법률에 특별한 규정이 있는 경우를 제외하고는 개인정보를 제3자에게 제공하지')
    expect(html).toContain('공개 모바일 명함 상담 신청 수집·이용')
    expect(html).toContain('그 공개 모바일 명함(/fc/슬러그)을 운영하는 설계사에게만')
    expect(html).toContain('서비스의 다른 이용자 전체에게 제공되지 않습니다')
    expect(html).toContain('법령상 보관 의무가 있는 경우를 제외하고 수집·이용 목적 달성 시 지체 없이 파기합니다')
    expect(html).toContain('상담 신청 접수가 제한됩니다')
    expect(html).toContain('접속 IP와 단말 정보는 상담 신청 기록에 저장하지 않습니다')
    expect(html).not.toContain('상담 목적 달성 후 일정 기간')
  })

  it('모달 동의문은 방침과 같은 보유 기간·전달 범위를 말한다', () => {
    expect(MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY).toContain(
      '법령상 보관 의무가 있는 경우를 제외하고, 수집·이용 목적 달성 시 지체 없이 파기합니다.',
    )
    expect(MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY).toContain(
      '해당 공개 모바일 명함(/fc/슬러그)을 운영하는 설계사에게만 전달됩니다.',
    )
    expect(MOBILE_CARD_CONSULTATION_PRIVACY_POLICY_BODY).not.toContain('일정 기간')
  })
})
