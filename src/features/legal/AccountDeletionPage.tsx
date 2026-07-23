import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BusinessInfoFooter } from '../web/components/BusinessInfoFooter'
import LegalInternalLink from './LegalInternalLink'
import LegalPageShell from './LegalPageShell'
import { accountDeletionSiteConfig as C } from './accountDeletionSiteConfig'

function setOrCreateMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export default function AccountDeletionPage() {
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
    <LegalPageShell title="계정 삭제 안내" pageId="account-deletion-top">
      <main className="legal-doc-page">
      <article className="legal-doc">
        <header className="legal-doc__header">
          <p className="legal-doc__meta">개정일 {C.lastRevisedDate}</p>
          <h1 className="legal-doc__title">ONE FC 계정 삭제 요청 안내</h1>
          <p className="legal-doc__lead">
            {C.operatorLegalName}(이하 &quot;회사&quot;)는 {C.serviceName} 이용자가 계정 및 관련 개인정보 삭제를
            요청할 수 있도록 아래 절차를 안내합니다. 본 페이지는 Google Play 등 앱 마켓의 계정 삭제 URL 요건을
            충족하기 위한 공개 안내입니다.
          </p>
        </header>

        <nav className="legal-doc__toc" aria-label="목차">
          <strong className="legal-doc__toc-title">목차</strong>
          <ol className="legal-doc__toc-list">
            <li>
              <a href="#s1">계정 삭제 요청 방법</a>
            </li>
            <li>
              <a href="#s2">요청 시 필요한 정보</a>
            </li>
            <li>
              <a href="#s3">삭제되는 데이터 유형</a>
            </li>
            <li>
              <a href="#s4">법령상 보관될 수 있는 데이터</a>
            </li>
            <li>
              <a href="#s5">처리 기간</a>
            </li>
            <li>
              <a href="#s6">담당자 연락처</a>
            </li>
          </ol>
        </nav>

        <section className="legal-doc__section" id="s1">
          <h2>1. 계정 삭제 요청 방법</h2>
          <p>계정 삭제는 즉시 자동 삭제되지 않으며, 아래 방법으로 <strong>삭제 요청을 접수</strong>합니다.</p>
          <ol className="legal-doc__list legal-doc__list--ordered">
            <li>
              <strong>앱·웹(권장)</strong> — {C.serviceName}에 로그인한 뒤{' '}
              <strong>내 정보 &gt; 계정 삭제 요청</strong> 메뉴에서 휴대폰 본인 인증 후 삭제 요청을 제출합니다.
            </li>
            <li>
              <strong>이메일</strong> — 아래 담당자 이메일로 &quot;계정 삭제 요청&quot; 제목과 함께 가입 아이디·
              연락처를 보내 주세요.
            </li>
            <li>
              <strong>전화</strong> — 아래 담당자 연락처로 계정 삭제 요청 의사를 전달해 주세요.
            </li>
          </ol>
          <p>
            계정 데이터만 초기화하고 계정 자체는 유지하려면, 로그인 후{' '}
            <strong>내 정보 &gt; 계정 초기화</strong> 기능을 이용해 주세요. 계정 초기화와 계정 삭제 요청은 서로
            다른 절차입니다.
          </p>
        </section>

        <section className="legal-doc__section" id="s2">
          <h2>2. 요청 시 필요한 정보</h2>
          <ul className="legal-doc__list">
            <li>가입 아이디(로그인 ID)</li>
            <li>가입 시 등록한 휴대폰 번호(본인 확인용)</li>
            <li>요청자 성명</li>
            <li>삭제 요청 사유(선택)</li>
            <li>앱 내 요청 시: 휴대폰 SMS 본인 인증 완료</li>
          </ul>
        </section>

        <section className="legal-doc__section" id="s3">
          <h2>3. 삭제되는 데이터 유형</h2>
          <p>삭제 요청이 접수·처리되면, 해당 계정에 연결된 아래 데이터가 삭제 또는 비식별 처리됩니다.</p>
          <ul className="legal-doc__list">
            <li>계정 정보(아이디, 표시 이름, 프로필, 휴대폰 번호 등)</li>
            <li>해당 계정이 등록·관리한 고객 정보 및 상담·메모·파일 등 업무 데이터</li>
            <li>서비스 이용 기록·설정·알림 등 계정에 귀속된 이용 데이터</li>
            <li>결제·구독 연동 정보(법령상 보관 대상은 제4조 참고)</li>
          </ul>
          <p>
            다른 이용자·테넌트(GA)에 속한 데이터는 삭제 대상에서 제외되며, 요청 계정 본인 소유 범위만
            처리됩니다.
          </p>
        </section>

        <section className="legal-doc__section" id="s4">
          <h2>4. 법령상 보관될 수 있는 데이터</h2>
          <p>관련 법령에 따라 아래 정보는 일정 기간 보관될 수 있습니다.</p>
          <ul className="legal-doc__list">
            <li>전자상거래 등에서의 소비자 보호에 관한 법률에 따른 계약·결제 기록</li>
            <li>통신비밀보호법 등에 따른 접속 로그·가입 기록</li>
            <li>분쟁 대응·부정 이용 방지를 위한 최소한의 감사 로그</li>
            <li>세법 등 기타 법령상 의무 보존 대상</li>
          </ul>
          <p>보관 기간이 경과하면 지체 없이 파기합니다. 자세한 내용은 개인정보처리방침을 참고해 주세요.</p>
        </section>

        <section className="legal-doc__section" id="s5">
          <h2>5. 처리 기간</h2>
          <ul className="legal-doc__list">
            <li>
              <strong>접수 확인</strong> — 요청 접수 후 영업일 기준 3일 이내 이메일 또는 앱 내 안내로 접수 사실을
              확인합니다.
            </li>
            <li>
              <strong>검토 시작</strong> — {C.reviewStartWithin} 검토를 시작합니다.
            </li>
            <li>
              <strong>처리 완료</strong> — 본인 확인 및 데이터 범위 확인 후 {C.completionWithin} 삭제 절차를
              완료합니다. 법령상 보관 데이터가 있는 경우 해당 기간 동안 분리 보관 후 파기합니다.
            </li>
          </ul>
          <p>요청 접수 후 계정 사용이 제한될 수 있으며, 처리 완료 시 로그인이 불가능해질 수 있습니다.</p>
        </section>

        <section className="legal-doc__section" id="s6">
          <h2>6. 담당자 연락처</h2>
          <p>계정 삭제 요청·문의는 아래로 연락해 주세요.</p>
          <ul className="legal-doc__list legal-doc__contact">
            <li>
              <strong>회사명</strong> {C.operatorLegalName}
            </li>
            <li>
              <strong>대표자</strong> {C.representativeName}
            </li>
            <li>
              <strong>개인정보 보호책임자</strong> {C.privacyOfficerName} ({C.privacyOfficerRole})
            </li>
            <li>
              <strong>이메일</strong>{' '}
              <a href={`mailto:${C.contactEmail}`} className="legal-doc__link">
                {C.contactEmail}
              </a>
            </li>
            <li>
              <strong>전화</strong>{' '}
              <a href={`tel:${C.contactPhone.replace(/-/g, '')}`} className="legal-doc__link">
                {C.contactPhone}
              </a>
            </li>
          </ul>
        </section>

        <footer className="legal-doc__footer">
          <p className="legal-doc__footer-note">
            <LegalInternalLink to={C.privacyPolicyPath} className="legal-doc__link">
              개인정보처리방침
            </LegalInternalLink>
            <span aria-hidden="true"> · </span>
            <Link to="/login" className="legal-doc__link">
              서비스 로그인
            </Link>
            <span aria-hidden="true"> · </span>
            <a href="#account-deletion-top" className="legal-doc__link">
              맨 위로
            </a>
          </p>
        </footer>
      </article>
    </main>
    <BusinessInfoFooter />
    </LegalPageShell>
  )
}
