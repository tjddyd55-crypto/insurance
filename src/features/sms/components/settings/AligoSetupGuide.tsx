import { useCallback, useState } from 'react'
import FormButton from '../../../../components/form/FormButton'
import {
  ALIGO_SETUP_CHECKLIST,
  ALIGO_SETUP_EXTERNAL_LINKS,
  resolveAligoOutboundIps,
} from '../../config/aligoSetup.config'

type Props = {
  /** @deprecated use outboundServerIps */
  serverIp?: string
  outboundServerIps?: string[]
  outboundServerIpHint?: string
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) {
    throw new Error('copy failed')
  }
}

function AligoOutboundIpRow({ ip }: { ip: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const handleCopy = useCallback(() => {
    void (async () => {
      try {
        await copyText(ip)
        setCopyState('copied')
        window.setTimeout(() => setCopyState('idle'), 2000)
      } catch {
        setCopyState('failed')
        window.setTimeout(() => setCopyState('idle'), 2500)
      }
    })()
  }, [ip])

  const copyLabel =
    copyState === 'copied' ? '복사됨' : copyState === 'failed' ? '복사 실패' : '복사'

  return (
    <div className="sms-aligo-setup__ip-row">
      <code className="sms-aligo-setup__ip-value">{ip}</code>
      <FormButton htmlType="button" variant="secondary" size="sm" onClick={handleCopy}>
        {copyLabel}
      </FormButton>
    </div>
  )
}

function AligoServerIpCard({ ips }: { ips: string[] }) {
  const [copyAllState, setCopyAllState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const handleCopyAll = useCallback(() => {
    void (async () => {
      try {
        await copyText(ips.join('\n'))
        setCopyAllState('copied')
        window.setTimeout(() => setCopyAllState('idle'), 2000)
      } catch {
        setCopyAllState('failed')
        window.setTimeout(() => setCopyAllState('idle'), 2500)
      }
    })()
  }, [ips])

  const copyAllLabel =
    copyAllState === 'copied' ? '전체 복사됨' : copyAllState === 'failed' ? '복사 실패' : '전체 복사'

  return (
    <div className="sms-aligo-setup__ip-card">
      <div className="sms-aligo-setup__ip-card-head">
        <p className="sms-aligo-setup__ip-label">
          {ips.length > 0
            ? `현재 CRM 발송 서버 IP (${ips.length}개)`
            : '현재 CRM 발송 서버 IP'}
        </p>
        {ips.length > 1 ? (
          <FormButton htmlType="button" variant="secondary" size="sm" onClick={handleCopyAll}>
            {copyAllLabel}
          </FormButton>
        ) : null}
      </div>
      {ips.length > 0 ? (
        <ul className="sms-aligo-setup__ip-list">
          {ips.map((ip) => (
            <li key={ip}>
              <AligoOutboundIpRow ip={ip} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="sms-aligo-setup__ip-empty">
          서버에 Railway Outbound Static IP 목록이 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.
        </p>
      )}
      <p className="sms-aligo-setup__ip-note">
        알리고 문자 API의 발송 서버 IP 허용 목록에 아래 IP를 모두 등록해 주세요.
      </p>
      <p className="sms-aligo-setup__ip-note sms-aligo-setup__ip-note--secondary">
        Railway Outbound Static IP가 변경되면 Aligo에도 동일하게 갱신해야 합니다.
      </p>
    </div>
  )
}

export function AligoSetupGuide({ serverIp, outboundServerIps, outboundServerIpHint }: Props) {
  const ips = resolveAligoOutboundIps({
    outboundServerIps,
    outboundServerIpHint: outboundServerIpHint ?? serverIp,
  })
  const ipsLabel = ips.length > 0 ? ips.join(', ') : '(미설정)'

  return (
    <div className="sms-aligo-setup">
      <section className="sms-module__guide sms-aligo-setup__summary" aria-labelledby="aligo-setup-title">
        <h2 id="aligo-setup-title" className="sms-aligo-setup__title">
          알리고 문자 연동 준비 절차
        </h2>
        <p className="sms-aligo-setup__lead">처음 연동할 때는 아래 단계를 확인해 주세요.</p>
        <ol className="sms-aligo-setup__summary-steps">
          <li>
            <strong>알리고 준비</strong> — 회원가입, 문자 충전, 발신번호 등록 승인, 문자 API에서 API Key
            발급
          </li>
          <li>
            <strong>Railway Outbound Static IP 전체 등록</strong> — 알리고 문자 API 발송 서버 IP 허용
            목록에 CRM 발송 IP를 모두 등록
          </li>
          <li>
            <strong>CRM 입력·테스트</strong> — 아래 입력칸 저장 후 즉시발송에서 테스트 문자 발송
          </li>
        </ol>
      </section>

      <AligoServerIpCard ips={ips} />

      <div className="sms-aligo-setup__links" aria-label="알리고 외부 링크">
        {ALIGO_SETUP_EXTERNAL_LINKS.map((link) => (
          <a
            key={link.id}
            className="sms-module__link-btn"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label}
          </a>
        ))}
      </div>

      <section className="sms-aligo-setup__checklist" aria-labelledby="aligo-setup-checklist-title">
        <h3 id="aligo-setup-checklist-title" className="sms-aligo-setup__subtitle">
          설정 전 확인사항
        </h3>
        <ul className="sms-aligo-setup__checklist-list">
          {ALIGO_SETUP_CHECKLIST.map((item) => (
            <li key={item}>
              <span className="sms-aligo-setup__check-icon" aria-hidden>
                ☐
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <details className="sms-aligo-setup__details">
        <summary className="sms-aligo-setup__details-summary">상세 설정 절차 보기</summary>
        <div className="sms-aligo-setup__details-body">
          <article className="sms-aligo-setup__step">
            <h4>1. 알리고 회원가입</h4>
            <p>알리고 사이트에서 회원가입 후 로그인해 주세요.</p>
          </article>
          <article className="sms-aligo-setup__step">
            <h4>2. 문자 충전</h4>
            <p>문자를 발송하려면 알리고에 문자 잔액이 있어야 합니다.</p>
            <p>문자 충전은 알리고 사이트에서 직접 진행해 주세요.</p>
          </article>
          <article className="sms-aligo-setup__step">
            <h4>3. 발신번호 등록</h4>
            <p>문자를 보낼 때 표시될 발신번호를 알리고에 먼저 등록해야 합니다.</p>
            <p>알리고에서 승인된 발신번호만 CRM에 입력할 수 있습니다.</p>
            <p className="sms-aligo-setup__path">
              발신번호 등록 위치: 알리고 로그인 → 발신번호 → 발신번호 관리 → 발신번호 추가하기
            </p>
            <p>
              발신번호 등록 시 통신서비스 이용증명원 등 증빙서류가 필요할 수 있습니다. 등록 심사 후
              승인된 번호만 문자 발송에 사용할 수 있습니다.
            </p>
          </article>
          <article className="sms-aligo-setup__step">
            <h4>4. 문자 API 신청/인증</h4>
            <p>알리고 로그인 후 문자 API 메뉴로 이동합니다.</p>
            <p className="sms-aligo-setup__path">위치: 문자 API → 신청/인증</p>
            <p>해당 화면에서 담당자 정보를 등록하고 API Key를 발급받습니다.</p>
          </article>
          <article className="sms-aligo-setup__step">
            <h4>5. Railway Outbound Static IP 전체 등록</h4>
            <p>알리고 문자 API의 발송 서버 IP 허용 목록에 아래 IP를 모두 등록해 주세요.</p>
            <ul>
              {ips.length > 0 ? (
                ips.map((ip) => (
                  <li key={ip}>
                    <strong>{ip}</strong>
                  </li>
                ))
              ) : (
                <li>(서버 IP 목록 미설정)</li>
              )}
            </ul>
            <p className="sms-aligo-setup__warn">
              주의: 알리고에 등록되지 않은 IP에서 API를 호출하면 인증 오류 또는 IP 오류가 발생할 수
              있습니다. Railway HA Static IP는 여러 개이므로 전부 등록해야 합니다. IP가 변경되면
              Aligo에도 동일하게 갱신해야 합니다.
            </p>
          </article>
          <article className="sms-aligo-setup__step">
            <h4>6. CRM에 연동 정보 입력</h4>
            <p>알리고에서 확인한 정보를 아래 입력칸에 저장합니다.</p>
            <ul>
              <li>알리고 아이디</li>
              <li>API Key</li>
              <li>기본 발신번호</li>
              <li>광고 표시명</li>
            </ul>
            <p>API Key는 저장 후 다시 전체 표시하지 않습니다. 변경할 때만 새로 입력해 주세요.</p>
          </article>
          <article className="sms-aligo-setup__step">
            <h4>7. 테스트 발송</h4>
            <p>설정 저장 후 즉시발송 화면에서 본인 번호로 테스트 문자를 발송해 주세요.</p>
            <p>확인할 내용:</p>
            <ul>
              <li>문자가 정상 수신되는지</li>
              <li>발신번호가 맞는지</li>
              <li>광고 문자일 경우 `(광고)` 문구와 무료수신거부 문구가 표시되는지</li>
              <li>알리고 발송내역에도 기록되는지</li>
            </ul>
          </article>
        </div>
      </details>

      <details className="sms-aligo-setup__details">
        <summary className="sms-aligo-setup__details-summary">자주 발생하는 오류</summary>
        <div className="sms-aligo-setup__details-body">
          <article className="sms-aligo-setup__faq">
            <h4>IP 오류</h4>
            <p>
              <strong>원인:</strong> 알리고에 CRM 발송 서버 IP가 등록되지 않은 경우 발생할 수
              있습니다.
            </p>
            <p>
              <strong>해결:</strong> 알리고 문자 API → 신청/인증 → 발송 서버 IP 허용 목록에 현재 CRM
              Railway Outbound IP 전체({ipsLabel})를 등록해 주세요.
            </p>
          </article>
          <article className="sms-aligo-setup__faq">
            <h4>발신번호 오류</h4>
            <p>
              <strong>원인:</strong> 알리고에 등록·승인되지 않은 발신번호를 CRM에 입력한 경우 발생할
              수 있습니다.
            </p>
            <p>
              <strong>해결:</strong> 알리고 발신번호 관리에서 발신번호 등록 승인 여부를 확인해
              주세요.
            </p>
          </article>
          <article className="sms-aligo-setup__faq">
            <h4>API Key 오류</h4>
            <p>
              <strong>원인:</strong> API Key가 잘못 입력되었거나 재발급 후 CRM에 반영되지 않은 경우
              발생할 수 있습니다.
            </p>
            <p>
              <strong>해결:</strong> 알리고 문자 API → 신청/인증에서 API Key를 확인하고 CRM에 다시
              입력해 주세요.
            </p>
          </article>
          <article className="sms-aligo-setup__faq">
            <h4>잔액 부족</h4>
            <p>
              <strong>원인:</strong> 알리고 문자 잔액이 부족하면 발송이 실패할 수 있습니다.
            </p>
            <p>
              <strong>해결:</strong> 알리고 사이트에서 문자 잔액을 충전해 주세요.
            </p>
          </article>
        </div>
      </details>
    </div>
  )
}
