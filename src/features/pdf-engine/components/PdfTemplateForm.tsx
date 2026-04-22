/**
 * 사용자용 자동 폼 빌더.
 *
 * 설계 의도:
 *   - `PdfFieldSpec` 배열만 받으면 입력 UI 를 그려낸다 — 문서별 UI 코드가 늘어나지 않는다.
 *   - 타입별 렌더는 `renderByType` 한 곳에서만 분기. Phase 2 에서 select/radio 를 추가할 때
 *     DB CHECK, 서버 스키마, 프론트 타입과 함께 이 switch 만 확장한다.
 *   - 검증은 서버에서 1차로 수행하므로, 프론트는 UX 용 가벼운 필수값 체크만 담당.
 *
 * 이 컴포넌트는 발급(HTTP) 을 직접 하지 않는다. 상위 페이지가 `onSubmit(values)` 에서 수행한다.
 */

import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactElement } from 'react'
import type { PdfFieldSpec, PdfFieldType } from '../types'

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
  for (const f of fields) out[f.fieldKey] = ''
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
  const common = {
    id: `pdf-field-${field.fieldKey}`,
    name: field.fieldKey,
    required: field.required,
    value,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValue(e.target.value),
  } as const

  switch (field.fieldType) {
    case 'textarea':
      return <textarea {...common} className="pdf-engine-form__textarea" rows={4} />
    case 'number':
      /* 모바일 키패드를 숫자로 유도(inputmode). 형식 검증은 서버에서 엄격하게 한다. */
      return (
        <input
          {...common}
          type="text"
          inputMode="decimal"
          pattern="[-0-9.,]*"
          className="pdf-engine-form__input"
        />
      )
    case 'date':
      /* HTML date 는 브라우저마다 포맷이 다르지만, 서버는 "YYYY-MM-DD" 로 정규화한다. */
      return <input {...common} type="date" className="pdf-engine-form__input" />
    case 'text':
    default:
      return <input {...common} type="text" className="pdf-engine-form__input" />
  }
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
      if (f.required && isEmpty(values[f.fieldKey] ?? '')) {
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
            htmlFor={`pdf-field-${field.fieldKey}`}
            className={
              'pdf-engine-form__label' +
              (field.required ? ' pdf-engine-form__label-required' : '')
            }
          >
            {field.label}
          </label>
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

/* 타입 명세 재사용을 위해 export — 향후 Phase 2 에서 이 타입만 확장하면 된다. */
export type { PdfFieldType }
