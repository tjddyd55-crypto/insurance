import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { FormButton, FormInput } from '../../../components/form'
import {
  ApiError,
  fetchContractOtpStatus,
  fetchContractPublicDocuments,
  fetchContractPublicSession,
  postContractOtpSend,
  postContractOtpVerify,
  postContractPublicOpen,
  type ContractDocumentRow,
  type ContractPublicSessionPayload,
} from './contractPublicClient'

function labelForDocStatus(st: string) {
  if (st === 'completed') return '완료'
  if (st === 'viewed' || st === 'pending') return '미완료'
  return st
}

export default function ContractSignPage() {
  const { linkCode: linkCodeParam } = useParams<{ linkCode: string }>()
  const linkCode = String(linkCodeParam ?? '').trim()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState<ContractPublicSessionPayload | null>(null)
  const [documents, setDocuments] = useState<ContractDocumentRow[] | null>(null)

  const [otpCode, setOtpCode] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [cooldownSec, setCooldownSec] = useState(0)

  const loadSession = useCallback(async () => {
    const data = await fetchContractPublicSession(linkCode)
    setSession(data)
    return data
  }, [linkCode])

  useEffect(() => {
    if (!linkCode) {
      setError('링크 코드가 없습니다.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    void loadSession()
      .then(async () => {
        if (cancelled) return
        try {
          await postContractPublicOpen(linkCode)
        } catch {
          /* open 기록 실패는 치명적이지 않음 */
        }
      })
      .catch((e) => {
        if (cancelled) return
        setSession(null)
        setError(e instanceof ApiError ? e.message : '정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [linkCode, loadSession])

  useEffect(() => {
    if (!linkCode || !session) return
    if (session.sendSession.authenticationRequired || session.blocked || session.completed) return
    let cancelled = false
    void fetchContractPublicDocuments(linkCode)
      .then((d) => {
        if (!cancelled) setDocuments(d.documents)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [linkCode, session])

  useEffect(() => {
    if (!linkCode || !session?.sendSession.authenticationRequired) return
    let cancelled = false
    void fetchContractOtpStatus(linkCode)
      .then((st) => {
        if (cancelled || !st.verified) return
        void loadSession()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [linkCode, session?.sendSession.authenticationRequired, loadSession])

  useEffect(() => {
    if (cooldownSec <= 0) return
    const t = window.setInterval(() => {
      setCooldownSec((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [cooldownSec])

  const refreshAuthorized = useCallback(async () => {
    const next = await loadSession()
    if (!next.sendSession.authenticationRequired) {
      const d = await fetchContractPublicDocuments(linkCode)
      setDocuments(d.documents)
    }
  }, [linkCode, loadSession])

  const handleSendOtp = async () => {
    setOtpError('')
    setOtpSending(true)
    try {
      await postContractOtpSend(linkCode)
      setCooldownSec(0)
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && e.retryAfterSec) {
        setCooldownSec(e.retryAfterSec)
      }
      setOtpError(e instanceof ApiError ? e.message : '인증번호를 요청하지 못했습니다.')
    } finally {
      setOtpSending(false)
    }
  }

  const handleVerify = async () => {
    setOtpError('')
    setOtpVerifying(true)
    try {
      await postContractOtpVerify(linkCode, otpCode)
      setOtpCode('')
      await refreshAuthorized()
    } catch (e) {
      setOtpError(e instanceof ApiError ? e.message : '인증에 실패했습니다.')
    } finally {
      setOtpVerifying(false)
    }
  }

  let body: ReactNode
  if (loading) {
    body = <p className="text-slate-600">불러오는 중…</p>
  } else if (error || !session) {
    body = (
      <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
        <p className="font-medium">유효하지 않은 링크입니다.</p>
        <p className="text-sm">{error || '요청을 확인할 수 없습니다.'}</p>
      </div>
    )
  } else if (session.blocked) {
    const reason = session.blockedReason
    const isCancelled = reason === 'cancelled'
    body = (
      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        {isCancelled ? (
          <>
            <p className="font-medium">취소된 전자서명 요청입니다.</p>
            <p className="text-sm">담당자에게 문의해주세요.</p>
          </>
        ) : (
          <>
            <p className="font-medium">이 링크는 더 이상 사용할 수 없습니다.</p>
            <p className="text-sm">만료되었거나 취소된 세션입니다. 담당자에게 문의해 주세요.</p>
          </>
        )}
      </div>
    )
  } else if (session.completed) {
    body = (
      <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <p className="text-lg font-semibold">서명이 완료되었습니다.</p>
        <p className="text-sm">담당자가 확인할 수 있도록 저장되었습니다.</p>
      </div>
    )
  } else if (session.sendSession.authenticationRequired) {
    const masked = session.sendSession.maskedPhone ?? '지정된 번호'
    body = (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-800">
            {session.sendSession.customerDisplayName}님, 계약서 확인을 위해 휴대폰 인증이 필요합니다.
          </p>
          <p className="mt-2 text-sm text-slate-600">인증번호는 계약서 발송 시 지정된 번호로만 발송됩니다.</p>
          <p className="mt-3 text-base font-semibold tracking-wide text-slate-900">{masked}</p>
        </div>

        {otpError ? <StatusMessage tone="error" message={otpError} /> : null}

        <div className="flex flex-col gap-2">
          <FormButton
            htmlType="button"
            variant="primary"
            disabled={otpSending || cooldownSec > 0}
            loading={otpSending}
            onClick={() => void handleSendOtp()}
          >
            {cooldownSec > 0 ? `인증번호 받기 (${cooldownSec}초 후)` : '인증번호 받기'}
          </FormButton>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="contract-otp-code">
            인증번호
          </label>
          <FormInput
            id="contract-otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6자리"
            maxLength={6}
          />
          <FormButton
            htmlType="button"
            variant="secondary"
            disabled={otpVerifying || otpCode.length !== 6}
            loading={otpVerifying}
            onClick={() => void handleVerify()}
          >
            인증 확인
          </FormButton>
        </div>

        <p className="text-xs text-slate-500">문자를 받지 못했거나 번호가 맞지 않으면 담당자에게 문의해 주세요.</p>
      </div>
    )
  } else {
    const docList = documents ?? session.documents
    body = (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="font-medium text-slate-900">서명할 문서</p>
          <p className="mt-1 text-sm text-slate-600">
            필수 문서를 모두 완료해야 전체 제출이 가능합니다. (서명 저장은 다음 단계에서 연결됩니다.)
          </p>
        </div>
        <ul className="space-y-2">
          {docList.map((d) => (
            <li key={d.id}>
              <Link
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-slate-300"
                to={`/contracts/sign/${encodeURIComponent(linkCode)}/documents/${encodeURIComponent(d.id)}`}
              >
                <span className="text-sm text-slate-900">
                  {d.required ? (
                    <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
                      필수
                    </span>
                  ) : (
                    <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                      선택
                    </span>
                  )}
                  {d.title || '문서'}
                </span>
                <span className="text-xs text-slate-500">{labelForDocStatus(d.status)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-center text-xl font-bold text-slate-900">계약서</h1>
        {body}
      </div>
    </div>
  )
}
