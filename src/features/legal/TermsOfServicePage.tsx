import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { businessInfo } from '../../config/businessInfo.config'
import { BusinessInfoFooter } from '../web/components/BusinessInfoFooter'
import { termsSiteConfig as C } from './termsSiteConfig'

function setOrCreateMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export default function TermsOfServicePage() {
  useEffect(() => {
    const prevTitle = document.title
    const descEl = document.querySelector('meta[name="description"]')
    const prevDescription = descEl?.getAttribute('content') ?? ''

    document.title = C.documentTitle
    setOrCreateMeta('description', C.metaDescription)
    setOrCreateMeta('robots', C.metaRobots)

    return () => {
      document.title = prevTitle
      setOrCreateMeta('description', prevDescription)
    }
  }, [])

  return (
    <>
      <main className="legal-doc-page" id="terms-top">
        <article className="legal-doc">
          <header className="legal-doc__header">
            <p className="legal-doc__meta">
              시행일 {C.effectiveDate} · 개정일 {C.lastRevisedDate}
            </p>
            <h1 className="legal-doc__title">이용약관</h1>
            <p className="legal-doc__lead">
              {C.operatorLegalName}(이하 &quot;회사&quot;)가 제공하는 {C.serviceName} 서비스(이하 &quot;서비스&quot;)의
              이용과 관련하여 회사와 이용자의 권리·의무 및 책임 사항을 규정합니다.
            </p>
          </header>

          <nav className="legal-doc__toc" aria-label="목차">
            <strong className="legal-doc__toc-title">목차</strong>
            <ol className="legal-doc__toc-list">
              <li>
                <a href="#t1">서비스 목적</a>
              </li>
              <li>
                <a href="#t2">이용계약의 성립</a>
              </li>
              <li>
                <a href="#t3">계정 관리</a>
              </li>
              <li>
                <a href="#t4">서비스 제공 및 변경</a>
              </li>
              <li>
                <a href="#t5">이용자의 의무</a>
              </li>
              <li>
                <a href="#t6">금지행위</a>
              </li>
              <li>
                <a href="#t7">요금 및 결제</a>
              </li>
              <li>
                <a href="#t8">서비스 이용 제한</a>
              </li>
              <li>
                <a href="#t9">책임 제한</a>
              </li>
              <li>
                <a href="#t10">지식재산권</a>
              </li>
              <li>
                <a href="#t11">개인정보 보호</a>
              </li>
              <li>
                <a href="#t12">약관 변경</a>
              </li>
              <li>
                <a href="#t13">준거법 및 관할</a>
              </li>
              <li>
                <a href="#t14">시행일</a>
              </li>
            </ol>
          </nav>

          <section className="legal-doc__section" id="t1">
            <h2>제1조 서비스 목적</h2>
            <p>
              본 약관은 회사가 제공하는 {C.serviceName} 서비스를 이용함에 있어 회사와 이용자 간의 권리·의무 및
              책임 사항을 정함을 목적으로 합니다. 서비스는 보험 설계·고객 관리 등 업무 지원을 위한 클라우드 기반
              도구를 제공합니다.
            </p>
          </section>

          <section className="legal-doc__section" id="t2">
            <h2>제2조 이용계약의 성립</h2>
            <p>
              이용계약은 이용자가 본 약관에 동의하고 회사가 정한 절차에 따라 회원 가입 또는 계정 발급을 신청한
              후, 회사가 이를 승인함으로써 성립합니다. 회사는 관련 법령 및 내부 운영 정책에 따라 가입 신청을
              거절하거나 보류할 수 있습니다.
            </p>
          </section>

          <section className="legal-doc__section" id="t3">
            <h2>제3조 계정 관리</h2>
            <p>
              이용자는 자신의 계정 정보(아이디, 비밀번호 등)를 선량한 관리자의 주의로 관리해야 하며, 제3자에게
              양도·대여·공유해서는 안 됩니다. 계정 관리 소홀로 발생한 손해에 대한 책임은 이용자에게 있으며,
              무단 사용이 의심되는 경우 회사에 즉시 알려야 합니다.
            </p>
          </section>

          <section className="legal-doc__section" id="t4">
            <h2>제4조 서비스 제공 및 변경</h2>
            <p>
              회사는 연중무휴 서비스 제공을 원칙으로 하나, 시스템 점검·장애·천재지변 등 불가피한 사유가 있는 경우
              서비스 제공을 일시 중단할 수 있습니다. 회사는 운영상·기술상 필요에 따라 서비스의 전부 또는 일부를
              변경할 수 있으며, 이용자에게 중대한 영향을 미치는 변경은 사전에 공지합니다.
            </p>
          </section>

          <section className="legal-doc__section" id="t5">
            <h2>제5조 이용자의 의무</h2>
            <p>이용자는 관련 법령, 본 약관, 서비스 이용 안내 및 회사가 통지한 운영 정책을 준수해야 합니다.</p>
            <ul className="legal-doc__list">
              <li>서비스 이용 과정에서 취득한 정보를 관련 법령 및 계약에 따라 적법하게 사용할 것</li>
              <li>고객·제3자의 개인정보를 보호하고, 필요한 동의·고지 의무를 이행할 것</li>
              <li>서비스 장애를 유발하거나 다른 이용자의 이용을 방해하지 않을 것</li>
            </ul>
          </section>

          <section className="legal-doc__section" id="t6">
            <h2>제6조 금지행위</h2>
            <p>이용자는 다음 각 호의 행위를 해서는 안 됩니다.</p>
            <ul className="legal-doc__list">
              <li>타인의 정보 도용, 허위 정보 등록, 부정한 방법으로 서비스 이용</li>
              <li>서비스 또는 회사의 프로그램을 무단 복제·변형·리버스 엔지니어링·자동화 수집하는 행위</li>
              <li>회사 또는 제3자의 지식재산권·영업비밀을 침해하는 행위</li>
              <li>법령 또는 공서양속에 반하는 정보의 전송·게시</li>
              <li>기타 회사가 합리적으로 부적절하다고 판단하는 행위</li>
            </ul>
          </section>

          <section className="legal-doc__section" id="t7">
            <h2>제7조 요금 및 결제</h2>
            <p>
              유료 서비스를 이용하는 경우, 요금·결제 수단·청구 주기 등은 서비스 화면, 별도 안내 또는 이용 계약에서
              정한 바에 따릅니다. 환불·해지·과금 정책 등 세부 사항이 별도로 정해지지 않은 경우, 회사는 관련
              법령과 운영 정책에 따라 안내하며, 이용자는 결제 전 안내 문구를 확인해야 합니다.
            </p>
            <p className="legal-doc__note">
              결제·환불 세부 정책은 서비스 내 결제 안내 및 별도 고지를 따릅니다. 확정되지 않은 사항에 대해 본
              약관에서 임의의 환불 조건을 약속하지 않습니다.
            </p>
          </section>

          <section className="legal-doc__section" id="t8">
            <h2>제8조 서비스 이용 제한</h2>
            <p>
              회사는 이용자가 본 약관 또는 관련 법령을 위반하거나 서비스 운영에 중대한 지장을 초래한 경우, 사전
              통지 후 또는 긴급한 경우 사후 통지로 서비스 이용을 제한·정지할 수 있습니다. 이용 제한과 관련한
              세부 기준은 운영 정책 및 관련 법령에 따릅니다.
            </p>
          </section>

          <section className="legal-doc__section" id="t9">
            <h2>제9조 책임 제한</h2>
            <p>
              회사는 천재지변, 불가항력, 이용자의 귀책 사유, 제3자의 불법 행위 등 회사의 합리적 통제 범위를 벗어난
              사유로 인한 손해에 대해 책임을 지지 않습니다. 관련 법령에서 달리 정하지 않는 한, 회사의 손해배상
              책임 범위는 이용자가 최근 유료 서비스 이용 대가를 실제로 지급한 기간에 따라 관련 법령이 허용하는
              범위 내에서 제한될 수 있습니다.
            </p>
          </section>

          <section className="legal-doc__section" id="t10">
            <h2>제10조 지식재산권</h2>
            <p>
              서비스 및 이에 포함된 소프트웨어, 디자인, 문서, 상표 등 일체의 지식재산권은 회사 또는 정당한
              권리자에게 귀속됩니다. 이용자는 회사의 사전 서면 동의 없이 이를 복제·전송·출판·배포·2차적 저작물
              작성 등으로 이용할 수 없습니다.
            </p>
          </section>

          <section className="legal-doc__section" id="t11">
            <h2>제11조 개인정보 보호</h2>
            <p>
              회사는 관련 법령이 정하는 바에 따라 이용자의 개인정보를 보호합니다. 개인정보의 수집·이용·보관·파기
              등에 관한 사항은{' '}
              <Link to="/privacy" className="legal-doc__link">
                개인정보처리방침
              </Link>
              에 따릅니다.
            </p>
            <ul className="legal-doc__list legal-doc__contact">
              <li>
                <strong>개인정보 보호책임자</strong> {businessInfo.privacyOfficerName}
              </li>
              <li>
                <strong>이메일</strong>{' '}
                <a href={`mailto:${businessInfo.businessEmail}`} className="legal-doc__link">
                  {businessInfo.businessEmail}
                </a>
              </li>
              <li>
                <strong>전화</strong>{' '}
                <a
                  href={`tel:${businessInfo.privacyOfficerPhone.replace(/\D/g, '')}`}
                  className="legal-doc__link"
                >
                  {businessInfo.privacyOfficerPhone}
                </a>
              </li>
            </ul>
          </section>

          <section className="legal-doc__section" id="t12">
            <h2>제12조 약관 변경</h2>
            <p>
              회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있습니다. 변경 내용은 시행일 7일
              전부터 서비스 내 공지 등 합리적인 방법으로 안내하며, 이용자에게 불리한 변경은 시행일 30일 전부터
              공지할 수 있습니다. 변경 약관 시행 이후에도 서비스를 계속 이용하는 경우 변경 약관에 동의한 것으로
              봅니다.
            </p>
          </section>

          <section className="legal-doc__section" id="t13">
            <h2>제13조 준거법 및 관할</h2>
            <p>
              본 약관과 서비스 이용과 관련한 분쟁에는 대한민국 법을 적용합니다. 분쟁이 발생한 경우 회사 본점
              소재지를 관할하는 법원을 제1심 관할 법원으로 합니다. 다만, 소비자와의 분쟁에 대해서는 관련
              법령이 정하는 관할 규정이 우선 적용될 수 있습니다.
            </p>
          </section>

          <section className="legal-doc__section" id="t14">
            <h2>부칙 (시행일)</h2>
            <p>본 약관은 {C.effectiveDate}부터 시행합니다.</p>
            <ul className="legal-doc__list legal-doc__contact">
              <li>
                <strong>상호</strong> {C.operatorLegalName}
              </li>
              <li>
                <strong>대표자</strong> {businessInfo.representativeName}
              </li>
              <li>
                <strong>주소</strong> {businessInfo.businessAddress}
              </li>
            </ul>
          </section>

          <footer className="legal-doc__footer">
            <p className="legal-doc__footer-note">
              <Link to="/login" className="legal-doc__link">
                서비스 로그인
              </Link>
              <span aria-hidden="true"> · </span>
              <Link to="/privacy" className="legal-doc__link">
                개인정보처리방침
              </Link>
              <span aria-hidden="true"> · </span>
              <a href="#terms-top" className="legal-doc__link">
                맨 위로
              </a>
            </p>
          </footer>
        </article>
      </main>
      <BusinessInfoFooter />
    </>
  )
}
