import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  businessInfo,
  formatPhoneForTelLink,
  getFtcBusinessVerificationUrl,
} from '../../../config/businessInfo.config'

type FooterItemProps = {
  label: string
  children: ReactNode
}

function FooterItem({ label, children }: FooterItemProps) {
  return (
    <span className="intro-business-footer__item">
      <span className="intro-business-footer__label">{label}</span>
      <span className="intro-business-footer__value">{children}</span>
    </span>
  )
}

export function BusinessInfoFooter() {
  const privacyPhoneHref = `tel:${formatPhoneForTelLink(businessInfo.privacyOfficerPhone)}`
  const businessEmailHref = `mailto:${businessInfo.businessEmail}`

  return (
    <footer className="intro-business-footer" aria-label="사업자 정보">
      <div className="intro-v2-shell intro-business-footer__inner">
        <div className="intro-business-footer__line" role="list">
          <FooterItem label="상호명">{businessInfo.businessName}</FooterItem>
          <FooterItem label="대표자">{businessInfo.representativeName}</FooterItem>
          <FooterItem label="사업자등록번호">{businessInfo.businessRegistrationNumber}</FooterItem>
        </div>

        <div className="intro-business-footer__line" role="list">
          <FooterItem label="주소">{businessInfo.businessAddress}</FooterItem>
          <FooterItem label="이메일">
            <a href={businessEmailHref} className="intro-business-footer__link">
              {businessInfo.businessEmail}
            </a>
          </FooterItem>
        </div>

        <div className="intro-business-footer__line" role="list">
          <FooterItem label="개인정보 보호책임자">{businessInfo.privacyOfficerName}</FooterItem>
          <FooterItem label="개인정보 문의">
            <a href={privacyPhoneHref} className="intro-business-footer__link">
              {businessInfo.privacyOfficerPhone}
            </a>
          </FooterItem>
        </div>

        {businessInfo.mailOrderRegistrationNumber ? (
          <div className="intro-business-footer__line" role="list">
            <FooterItem label="통신판매업 신고번호">
              {businessInfo.mailOrderRegistrationNumber}
            </FooterItem>
          </div>
        ) : null}

        {businessInfo.hostingProviderName ? (
          <div className="intro-business-footer__line" role="list">
            <FooterItem label="호스팅서비스 제공자">{businessInfo.hostingProviderName}</FooterItem>
          </div>
        ) : null}

        <nav className="intro-business-footer__links" aria-label="법적 고지 링크">
          <Link to="/terms" className="intro-business-footer__nav-link">
            이용약관
          </Link>
          <span className="intro-business-footer__sep" aria-hidden="true">
            |
          </span>
          <Link to="/privacy" className="intro-business-footer__nav-link">
            개인정보처리방침
          </Link>
          <span className="intro-business-footer__sep" aria-hidden="true">
            |
          </span>
          <Link to="/account-deletion" className="intro-business-footer__nav-link">
            계정 삭제 안내
          </Link>
          <span className="intro-business-footer__sep" aria-hidden="true">
            |
          </span>
          <a
            href={getFtcBusinessVerificationUrl()}
            className="intro-business-footer__nav-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            사업자정보 확인
          </a>
        </nav>

        <p className="intro-business-footer__copyright">
          Copyright © {businessInfo.copyrightYear} {businessInfo.businessName}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
