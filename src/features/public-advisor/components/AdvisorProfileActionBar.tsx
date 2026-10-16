/** 모바일 명함 하단 액션. 향후 QR·채팅·ONE FC 연결 등 슬롯 확장 가능. */
type ActionBarProps = {
  phoneNumber: string
  kakaoLink: string
  allowConsultation: boolean
  onPhoneClick: () => void
  onKakaoClick: () => void
  onConsultClick: () => void
  onShareClick: () => void
}

function IconPhone() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.6 10.8c1.5 2.9 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.1 21 3 13.9 3 5c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconKakao() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c-5.5 0-10 3.6-10 8 0 2.6 1.4 4.9 3.6 6.4L5 21l3.6-2c1.1.3 2.2.5 3.4.5 5.5 0 10-3.6 10-8s-4.5-8-10-8z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconConsult() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5h16a1 1 0 011 1v9a1 1 0 01-1 1H8l-4 3V6a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconShare() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v12M12 3l4 4M12 3L8 7M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AdvisorProfileActionBar({
  phoneNumber,
  kakaoLink,
  allowConsultation,
  onPhoneClick,
  onKakaoClick,
  onConsultClick,
  onShareClick,
}: ActionBarProps) {
  const tel = phoneNumber.replace(/\s/g, '')
  const showKakao = Boolean(kakaoLink?.trim())

  return (
    <nav className="pap-action-bar" aria-label="연락 및 공유">
      {tel ? (
        <a
          className="pap-action-bar__item pap-action-bar__item--phone"
          href={`tel:${tel}`}
          onClick={onPhoneClick}
        >
          <span className="pap-action-bar__icon"><IconPhone /></span>
          <span className="pap-action-bar__label">전화</span>
        </a>
      ) : null}
      {showKakao ? (
        <a
          className="pap-action-bar__item pap-action-bar__item--kakao"
          href={kakaoLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onKakaoClick}
        >
          <span className="pap-action-bar__icon"><IconKakao /></span>
          <span className="pap-action-bar__label">카카오톡</span>
        </a>
      ) : null}
      {allowConsultation ? (
        <button type="button" className="pap-action-bar__item pap-action-bar__item--consult" onClick={onConsultClick}>
          <span className="pap-action-bar__icon"><IconConsult /></span>
          <span className="pap-action-bar__label">상담</span>
        </button>
      ) : null}
      <button type="button" className="pap-action-bar__item pap-action-bar__item--share" onClick={onShareClick}>
        <span className="pap-action-bar__icon"><IconShare /></span>
        <span className="pap-action-bar__label">공유</span>
      </button>
    </nav>
  )
}
