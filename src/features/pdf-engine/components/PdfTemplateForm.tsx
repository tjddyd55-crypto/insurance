/**
 * 사용자용 자동 폼 빌더.
 *
 * 설계 의도:
 *   - `PdfFieldSpec` 배열만 받으면 입력 UI 를 그려낸다 — 문서별 UI 코드가 늘어나지 않는다.
 *   - 타입별 렌더는 `renderByType` 한 곳에서만 분기. 새 타입이 생기면 DB CHECK, 서버 스키마,
 *     프론트 타입과 함께 이 switch 만 확장한다.
 *   - 검증은 서버에서 1차로 수행하므로, 프론트는 UX 용 가벼운 필수값 체크만 담당.
 *
 * 이 컴포넌트는 발급(HTTP) 을 직접 하지 않는다. 상위 페이지가 `onSubmit(values)` 에서 수행한다.
 *
 * 값 컨벤션(Record<string, string>):
 *   - text/number/date/textarea: 사용자가 입력한 문자열
 *   - checkbox: "true" | "false" (빈 문자열은 "false" 로 취급)
 *   - radio: 선택된 옵션 문자열. 미선택은 "" (빈 문자열)
 *   이 컨벤션은 서버의 validateRenderValues 와 짝을 이룬다 — 바뀌면 양쪽 동시 수정.
 */

import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactElement } from 'react'
import type { PdfCustomerMapping, PdfFieldSpec, PdfFieldType } from '../types'

/**
 * 자동 매핑 배지 라벨.
 * 사용자에게 "서버가 내 계정 정보로 채운다" 는 메타 정보를 노출해,
 * 입력 여부를 판단할 수 있게 한다.
 * 매핑 키가 늘어나면 이 맵만 확장한다.
 */
const CUSTOMER_MAPPING_LABEL: Record<PdfCustomerMapping, string> = {
  name: '이름',
  dob: '생년월일',
  phone: '전화번호',
  address: '주소',
}

interface Props {
  title: string
  description?: string
  fields: PdfFieldSpec[]
  submitting?: boolean
  onSubmit: (values: Record<string, string>) => Promise<void> | void
  submitLabel?: string
}

function initialValues(fields: PdfFieldSpec[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fields) {
    /* checkbox 는 "false" 가 기본값이어야 서버와 컨벤션이 일치한다. */
    out[f.fieldKey] = f.fieldType === 'checkbox' ? 'false' : ''
  }
  return out
}

function isEmpty(value: string): boolean {
  return !value || !value.trim()
}

/** 타입별 기본 위젯. 주석은 "왜 이 입력을 썼는지" 만 남긴다. */
function renderByType(
  field: PdfFieldSpec,
  value: string,
  setValue: (v: string) => void,
): ReactElement {
  const inputId = `pdf-field-${field.fieldKey}`

  switch (field.fieldType) {
    case 'textarea':
      return (
        <textarea
          id={inputId}
          name={field.fieldKey}
          required={field.required}
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
          className="pdf-engine-form__textarea"
          rows={4}
        />
      )
    case 'date':
      /* HTML date 는 브라우저마다 포맷이 다르지만, 서버는 "YYYY-MM-DD" 로 정규화한다. */
      return (
        <input
          id={inputId}
          name={field.fieldKey}
          required={field.required}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
          type="date"
          className="pdf-engine-form__input"
        />
      )
    case 'checkbox': {
      /* 단일 체크박스. 값은 문자열 "true"/"false" 로 표현(서버 컨벤션). */
      const checked = value === 'true'
      return (
        <div className="pdf-engine-form__checkbox-row">
          <input
            id={inputId}
            name={field.fieldKey}
            type="checkbox"
            checked={checked}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setValue(e.target.checked ? 'true' : 'false')
            }
          />
          <span className="pdf-engine-form__checkbox-caption">
            {field.required ? '동의(필수)' : '동의'}
          </span>
        </div>
      )
    }
    case 'radio': {
      /* 옵션이 없으면(데이터 결함) 안내 문구만 표시한다 — 서버 정규화에서 막히므로 정상 운영 중에는 오지 않는다. */
      const options = field.options ?? []
      if (options.length === 0) {
        return (
          <p className="pdf-engine-page__hint">
            옵션이 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.
          </p>
        )
      }
      return (
        <div className="pdf-engine-form__radio-group" role="radiogroup" aria-labelledby={`${inputId}-label`}>
          {options.map((opt, idx) => {
            const id = `${inputId}-${idx}`
            return (
              <label key={id} htmlFor={id} className="pdf-engine-form__radio-item">
                <input
                  id={id}
                  type="radio"
                  name={field.fieldKey}
                  value={opt}
                  checked={value === opt}
                  onChange={() => setValue(opt)}
                />
                <span>{opt}</span>
              </label>
            )
          })}
        </div>
      )
    }
    case 'text':
    default:
      return (
        <input
          id={inputId}
          name={field.fieldKey}
          required={field.required}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
          type="text"
          className="pdf-engine-form__input"
        />
      )
  }
}

/** 타입별 필수값 위반 여부. 체크박스는 "true" 여야만 통과(필수 동의). */
function isRequiredViolated(field: PdfFieldSpec, value: string): boolean {
  if (!field.required) return false
  if (field.fieldType === 'checkbox') return value !== 'true'
  return isEmpty(value)
}

export function PdfTemplateForm({
  title,
  description,
  fields,
  submitting = false,
  onSubmit,
  submitLabel = '발급하기',
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields))
  const [error, setError] = useState<string | null>(null)

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.orderIndex - b.orderIndex),
    [fields],
  )

  const setValue = (key: string) => (next: string) =>
    setValues((prev) => ({ ...prev, [key]: next }))

  const handleSubmit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    setError(null)

    for (const f of sortedFields) {
      if (isRequiredViolated(f, values[f.fieldKey] ?? '')) {
        setError(`"${f.label}" 은(는) 필수 입력입니다.`)
        return
      }
    }

    try {
      await onSubmit(values)
    } catch (e) {
      setError(e instanceof Error ? e.message : '발급에 실패했습니다.')
    }
  }

  return (
    <form className="pdf-engine-form" onSubmit={handleSubmit} noValidate>
      <header className="pdf-engine-form__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>

      {error ? <div className="pdf-engine-page__error">{error}</div> : null}

      {sortedFields.length === 0 ? (
        <p className="pdf-engine-page__hint">이 문서에는 입력 항목이 없습니다.</p>
      ) : null}

      {sortedFields.map((field) => (
        <div key={field.fieldKey} className="pdf-engine-form__field">
          <label
            id={`pdf-field-${field.fieldKey}-label`}
            htmlFor={`pdf-field-${field.fieldKey}`}
            className={
              'pdf-engine-form__label' +
              (field.required ? ' pdf-engine-form__label-required' : '')
            }
          >
            {field.label}
            {field.customerMapping ? (
              <span className="pdf-engine-form__mapping-badge" title="회원 정보로 자동 입력됩니다">
                {CUSTOMER_MAPPING_LABEL[field.customerMapping]} 자동
              </span>
            ) : null}
          </label>
          {field.customerMapping ? (
            <p className="pdf-engine-form__mapping-hint">
              비워두면 회원 정보에 등록된 값으로 자동 입력됩니다. 다르게 출력하려면 여기에 입력하세요.
            </p>
          ) : null}
          {renderByType(field, values[field.fieldKey] ?? '', setValue(field.fieldKey))}
        </div>
      ))}

      <div className="pdf-engine-form__actions">
        <button
          type="submit"
          className="pdf-engine-form__primary"
          disabled={submitting || sortedFields.length === 0}
        >
          {submitting ? '생성 중…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

/* 타입 명세 재사용을 위해 export — 향후 확장 시 이 타입만 확장하면 된다. */
export type { PdfFieldType }
