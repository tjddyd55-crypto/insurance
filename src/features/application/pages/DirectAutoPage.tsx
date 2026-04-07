import { useState } from 'react'
import { PageBackButton } from '../../../components/common/PageBackButton'

const FIELD_SHELL = 'rounded-xl border-2 border-[#14b8a6] bg-[var(--bg-main)] px-3 py-3 text-[var(--text-primary)]'

type DirectAutoDesignFormState = {
  가입조건: string
  고객유형: string
  고객명: string
  연락처: string
  차량유형: string
}

const INITIAL_FORM: DirectAutoDesignFormState = {
  가입조건: '',
  고객유형: '',
  고객명: '',
  연락처: '',
  차량유형: '',
}

function SelectChevron() {
  return (
    <span
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0f766e] opacity-85"
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/**
 * 다이렉트 자동차 1단계 — 설계요청 폼 UI만 (검증·API 없음).
 */
export function DirectAutoPage() {
  const [form, setForm] = useState<DirectAutoDesignFormState>(INITIAL_FORM)

  const setField = <K extends keyof DirectAutoDesignFormState>(key: K, value: DirectAutoDesignFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <main className="page page--with-back">
      <PageBackButton />
      <header className="page-header">
        <h1>설계요청</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-2 leading-relaxed">
          설계를 위한 정보를 입력해주세요
          <br />
          모든 항목을 입력해주세요
        </p>
      </header>

      <section className="w-full max-w-lg mx-auto space-y-5 px-1 pb-10">
        <div className="rounded-xl border-2 border-[#14b8a6] bg-[var(--bg-elevated)] p-4 sm:p-5 space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">가입조건</span>
            <div className="relative">
              <select
                className={`w-full ${FIELD_SHELL} appearance-none pr-11`}
                value={form.가입조건}
                onChange={(e) => setField('가입조건', e.target.value)}
              >
                <option value="">선택</option>
                <option value="신규">신규</option>
                <option value="갱신">갱신</option>
              </select>
              <SelectChevron />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">고객유형</span>
            <div className="relative">
              <select
                className={`w-full ${FIELD_SHELL} appearance-none pr-11`}
                value={form.고객유형}
                onChange={(e) => setField('고객유형', e.target.value)}
              >
                <option value="">선택</option>
                <option value="개인">개인</option>
                <option value="사업자">사업자</option>
              </select>
              <SelectChevron />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">고객명</span>
            <input
              type="text"
              name="direct-auto-customer-name"
              autoComplete="name"
              placeholder="고객명 입력"
              className={`w-full ${FIELD_SHELL}`}
              value={form.고객명}
              onChange={(e) => setField('고객명', e.target.value)}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">연락처</span>
            <input
              type="tel"
              name="direct-auto-phone"
              autoComplete="tel"
              placeholder="연락처 입력"
              className={`w-full ${FIELD_SHELL}`}
              value={form.연락처}
              onChange={(e) => setField('연락처', e.target.value)}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">차량유형</span>
            <div className="relative">
              <select
                className={`w-full ${FIELD_SHELL} appearance-none pr-11`}
                value={form.차량유형}
                onChange={(e) => setField('차량유형', e.target.value)}
              >
                <option value="">선택</option>
                <option value="기존차량">기존차량</option>
                <option value="신차">신차</option>
              </select>
              <SelectChevron />
            </div>
          </label>
        </div>

        <button
          type="button"
          className="button button--primary button--full rounded-xl py-3.5 font-medium"
          onClick={() => {
            console.log(form)
          }}
        >
          다음
        </button>
      </section>
    </main>
  )
}
