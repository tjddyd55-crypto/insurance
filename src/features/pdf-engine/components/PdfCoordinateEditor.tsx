/**
 * 관리자 좌표 에디터.
 *
 * UX 원칙: "라벨 우선 + 박스 우선".
 *   1) 왼쪽 패널에서 라벨·타입·필수만 입력해 필드를 정의한다.
 *      (내부 식별자 `fieldKey` 는 라벨에서 자동 파생 — 관리자가 다룰 필요 없음.)
 *   2) 필드를 선택한 상태로 오른쪽 PDF 위를 "드래그" 하면 박스 placement 가 추가된다.
 *      — 드래그 거리가 너무 짧으면(실수 클릭) 무시된다.
 *   3) 등록된 placement 를 좌측에서 골라 width/height/fontSize/align 을 바로 편집한다.
 *
 * 저장 형식:
 *   - 좌표·크기는 PDF 포인트(원점 좌하단). 해상도 무관.
 *   - 호출측(페이지 컴포넌트) 이 이 필드 배열을 서버 API 로 PUT 한다.
 *
 * 이 컴포넌트 자체는 I/O 를 하지 않는다 — 입력(fields)과 출력(onChange)만으로 동작.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PdfFieldSpec, PdfFieldType, PdfPlacement } from '../types'
import { PDF_FIELD_TYPE_LABELS, PDF_FIELD_TYPES } from '../types'
import { genPdfFieldKeyFromLabel } from '../pdfFieldKey'
import { PdfOverlayCanvas, type OverlayMark, type OverlayPick, type PdfOverlayDebugMeta } from './PdfOverlayCanvas'
import FormInput from '../../../components/form/FormInput'

/** 1차 UX: 좌표 숫자 편집 숨김. 고급 설정으로 되살릴 때 `true` 로 전환해 `PlacementMetaEditor` 를 연결. */
const SHOW_PLACEMENT_NUMERIC_EDITOR = false

interface Props {
  pdfBuffer: ArrayBuffer | null
  pageCount: number
  fields: PdfFieldSpec[]
  onChange: (next: PdfFieldSpec[]) => void
  onSaveFields: () => void
  savingFields: boolean
  fieldsDirty: boolean
  /** 좌표 화면 개발 로그용(스토리지 경로는 넣지 않음) */
  templateId?: number
}

type DraftField = {
  label: string
  fieldType: PdfFieldType
  required: boolean
}

const EMPTY_DRAFT: DraftField = {
  label: '',
  fieldType: 'text',
  required: false,
}

/**
 * 필드의 "기본 텍스트 박스 크기" 가 없어 placement.width 가 null 인 경우(기존 점 배치)
 * 편집 UI 의 숫자 입력에 표시할 값은 빈 문자열이 되어야 한다. 0 을 보여주면
 * 관리자가 "0 이 할당됐다"고 착각할 여지가 생긴다.
 */
function numericInputValue(v: number | null | undefined): string {
  if (v == null) return ''
  return String(v)
}

/** 숫자 입력 문자열을 placement 용 숫자(|null) 로 파싱한다. 비어 있으면 null. */
function parseOptionalPositive(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return 'invalid'
  return Math.round(n * 100) / 100
}

export function PdfCoordinateEditor({
  pdfBuffer,
  pageCount,
  fields,
  onChange,
  onSaveFields,
  savingFields,
  fieldsDirty,
  templateId,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  /**
   * 같은 필드 안의 여러 placement 중 "어느 것을 편집 중" 인지.
   * 필드가 바뀌면 자동으로 리셋된다. 여러 placement 가 있으면 마지막에 추가된 것을 기본 선택.
   */
  const [selectedPlacementIndex, setSelectedPlacementIndex] = useState<number | null>(null)
  /**
   * radio 필드에서 "지금 캔버스에 추가할 placement 가 대표할 옵션".
   * 새 placement 가 생길 때 이 값이 optionValue 로 박힌다.
   * 필드가 바뀌면 해당 필드의 첫 옵션으로 자동 동기화된다.
   */
  const [activeOptionValue, setActiveOptionValue] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftField>(EMPTY_DRAFT)
  const [pageIndex, setPageIndex] = useState(0)
  const [numPages, setNumPages] = useState(pageCount > 0 ? pageCount : 1)

  useEffect(() => {
    if (pageCount > 0) setNumPages(pageCount)
  }, [pageCount])

  const overlayDebugMeta = useMemo((): PdfOverlayDebugMeta | undefined => {
    if (templateId == null) return undefined
    return {
      pdfTemplateId: templateId,
      serverPageCount: pageCount > 0 ? pageCount : undefined,
      fetchUrlPath: `/api/admin/pdf-templates/${templateId}/file`,
    }
  }, [templateId, pageCount])

  useEffect(() => {
    /* 서버 pageCount 와 pdfjs 실제 페이지 수가 어긋나면, 열람 중 페이지가 범위를 벗어나지 않게 한다. */
    setPageIndex((i) => Math.min(i, Math.max(0, numPages - 1)))
  }, [numPages])

  /**
   * 부모가 fieldKey 를 정규화(예: `2` → `field_2`)하면 선택 상태가 고아가 되므로 동기화한다.
   */
  useEffect(() => {
    setSelectedKey((cur) => {
      if (cur == null) return null
      return fields.some((f) => f.fieldKey === cur) ? cur : null
    })
  }, [fields])

  const existingKeys = useMemo(() => new Set(fields.map((f) => f.fieldKey)), [fields])

  /** 왼쪽 필드 목록의 placement 들을 overlay 마커로 변환.
      박스 placement 는 width/height 를 같이 넘겨 사각형 마커로 그려진다. */
  const marks: OverlayMark[] = useMemo(() => {
    const out: OverlayMark[] = []
    for (const f of fields) {
      const isActiveField = f.fieldKey === selectedKey
      for (let i = 0; i < f.placements.length; i += 1) {
        const p = f.placements[i]
        const isActivePlacement = isActiveField && i === selectedPlacementIndex
        const baseLabel = f.label || `필드 ${f.orderIndex + 1}`
        /* radio 는 "어느 옵션" 인지 라벨에 같이 표기해야 관리자가 화면에서 즉시 구분할 수 있다. */
        const composedLabel = p.optionValue ? `${baseLabel} · ${p.optionValue}` : baseLabel
        out.push({
          id: `${f.fieldKey}-${i}`,
          pageIndex: p.page,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          label: composedLabel,
          selected: isActiveField && (isActivePlacement || f.placements.length === 1),
        })
      }
    }
    return out
  }, [fields, selectedKey, selectedPlacementIndex])

  const handleAddField = () => {
    const labelTrim = draft.label.trim()
    if (!labelTrim) return
    /* 내부 식별자는 라벨에서 자동 파생. 같은 템플릿 내 충돌은 genPdfFieldKeyFromLabel 이
       suffix 로 회피하므로 사용자는 식별자를 의식할 필요가 없다. */
    const key = genPdfFieldKeyFromLabel(labelTrim, existingKeys)
    /* radio 로 바로 만들면 기본 옵션 2개를 시드해 관리자가 빈 상태로 드래그했을 때
       "옵션이 비어 있다" 에러를 만나지 않도록 한다. */
    const options = draft.fieldType === 'radio' ? ['옵션1', '옵션2'] : null
    const next: PdfFieldSpec = {
      fieldKey: key,
      label: labelTrim,
      fieldType: draft.fieldType,
      required: draft.required,
      orderIndex: fields.length,
      /** PDF 저장 시 서버가 비서명 필드는 모두 customer 로 정규화 — 여기서는 위치만 정의 */
      inputRole: 'customer',
      options,
      placements: [],
    }
    onChange([...fields, next])
    setSelectedKey(key)
    setSelectedPlacementIndex(null)
    setActiveOptionValue(options?.[0] ?? null)
    setDraft(EMPTY_DRAFT)
  }

  const handleRemoveField = (key: string) => {
    if (!window.confirm('해당 필드를 삭제할까요? 모든 좌표도 함께 제거됩니다.')) return
    const next = fields.filter((f) => f.fieldKey !== key).map((f, i) => ({ ...f, orderIndex: i }))
    onChange(next)
    if (selectedKey === key) {
      setSelectedKey(null)
      setSelectedPlacementIndex(null)
    }
  }

  const handlePatchField = (key: string, patch: Partial<PdfFieldSpec>) => {
    onChange(
      fields.map((f) => {
        if (f.fieldKey !== key) return f
        const next: PdfFieldSpec = { ...f, ...patch }
        /* 타입이 checkbox/radio 가 아닌 값으로 바뀌면 options 와 placement.optionValue 를 제거한다.
           서버 정규화에서 걸러지지만, UI 상태도 일관되게 유지해야 편집 중 혼란이 없다. */
        if (patch.fieldType && patch.fieldType !== 'radio' && patch.fieldType !== 'checkbox') {
          next.options = null
          next.placements = next.placements.map((p) => ({ ...p, optionValue: null }))
        }
        /* checkbox/radio 로 새로 전환되는 경우, 옵션이 아직 없으면 기본 옵션 2개를 시드. */
        if (
          (patch.fieldType === 'radio' || patch.fieldType === 'checkbox') &&
          (!next.options || next.options.length === 0)
        ) {
          next.options = ['옵션1', '옵션2']
        }
        return next
      }),
    )
  }

  /**
   * radio 전용: options 배열을 교체한다.
   * 옵션이 제거되면 그 옵션을 대표하던 placement 의 optionValue 를 남은 첫 옵션으로 이주시킨다.
   * 이 "이주" 정책이 없으면 저장 시점에 서버가 전체 필드를 거부하므로 UX 가 깨진다.
   */
  const handlePatchFieldOptions = (key: string, nextOptions: string[]) => {
    onChange(
      fields.map((f) => {
        if (f.fieldKey !== key) return f
        const allowed = new Set(nextOptions)
        const fallback = nextOptions[0] ?? null
        const placements = f.placements.map((p) => {
          if (p.optionValue && allowed.has(p.optionValue)) return p
          return { ...p, optionValue: fallback }
        })
        return { ...f, options: nextOptions, placements }
      }),
    )
    /* 활성 옵션이 제거됐다면 첫 옵션으로 재정렬. */
    if (!activeOptionValue || !nextOptions.includes(activeOptionValue)) {
      setActiveOptionValue(nextOptions[0] ?? null)
    }
  }

  const handleRemovePlacement = (key: string, index: number) => {
    onChange(
      fields.map((f) =>
        f.fieldKey === key
          ? {
              ...f,
              placements: f.placements.filter((_, i) => i !== index),
            }
          : f,
      ),
    )
    /* 삭제 대상이 현재 선택된 placement 면 선택 해제. 이후 인덱스는 바뀌므로
       단순히 null 로 돌려 놓는 편이 예측 가능하다. */
    if (selectedKey === key && selectedPlacementIndex === index) {
      setSelectedPlacementIndex(null)
    } else if (
      selectedKey === key &&
      selectedPlacementIndex != null &&
      selectedPlacementIndex > index
    ) {
      setSelectedPlacementIndex(selectedPlacementIndex - 1)
    }
  }

  /** 선택된 필드의 특정 placement 를 부분 갱신한다. */
  const handlePatchPlacement = useCallback(
    (key: string, index: number, patch: Partial<PdfPlacement>) => {
      onChange(
        fields.map((f) =>
          f.fieldKey === key
            ? {
                ...f,
                placements: f.placements.map((p, i) => (i === index ? { ...p, ...patch } : p)),
              }
            : f,
        ),
      )
    },
    [fields, onChange],
  )

  const handlePick = useCallback(
    (pick: OverlayPick) => {
      if (!selectedKey) {
        window.alert('먼저 왼쪽에서 필드를 선택한 뒤 PDF 위를 드래그하세요.')
        return
      }
      const target = fields.find((f) => f.fieldKey === selectedKey) ?? null
      /* checkbox/radio 는 "어느 옵션 좌표를 그릴지" 선택이 전제. 선택된 옵션이 없으면
         첫 옵션으로 폴백하고, 그마저 없으면 placement 생성을 거부해 오염 데이터 방지. */
      let optionValue: string | null = null
      if (target?.fieldType === 'radio' || target?.fieldType === 'checkbox') {
        const opts = target.options ?? []
        if (opts.length === 0) {
          window.alert('선택형 필드에 옵션이 없습니다. 먼저 옵션을 1개 이상 추가해 주세요.')
          return
        }
        optionValue = activeOptionValue && opts.includes(activeOptionValue) ? activeOptionValue : opts[0]
      }
      /* 드래그(박스) 결과가 오면 그 치수를, 단일 클릭이면 width/height = null 로 저장.
         서버는 null 일 때 단일 라인 렌더로 폴백하므로 양쪽 모두 안전. */
      const placement: PdfPlacement = {
        page: pick.pageIndex,
        x: pick.x,
        y: pick.y,
        width: pick.width != null ? pick.width : null,
        height: pick.height != null ? pick.height : null,
        fontSize: null,
        align: 'center',
        optionValue,
      }
      let nextIndex = 0
      const nextFields = fields.map((f) => {
        if (f.fieldKey !== selectedKey) return f
        /*
         * non-radio 필드는 좌표를 1개만 유지한다.
         * 잘못 찍은 경우 다시 찍으면 기존 박스를 즉시 교체해 화면/결과물이 일치하도록 한다.
         */
        if (f.fieldType !== 'radio' && f.fieldType !== 'checkbox') {
          nextIndex = 0
          return { ...f, placements: [placement] }
        }
        /*
         * 기본 동작은 "선택된 좌표 수정(덮어쓰기)".
         * 사용자가 같은 필드에서 좌표를 다시 찍을 때 이전 박스가 남아 누적되는 혼란을 방지한다.
         * 새 좌표를 추가하고 싶을 때는 좌표 목록의 "새 좌표 추가" 버튼으로 선택을 해제한 상태에서 찍는다.
         */
        if (selectedPlacementIndex != null && f.placements[selectedPlacementIndex]) {
          nextIndex = selectedPlacementIndex
          return {
            ...f,
            placements: f.placements.map((p, i) => (i === selectedPlacementIndex ? placement : p)),
          }
        }
        nextIndex = f.placements.length
        return { ...f, placements: [...f.placements, placement] }
      })
      onChange(nextFields)
      /* 방금 추가한 placement 를 자동 선택해, 관리자가 곧바로 메타 편집을 이어갈 수 있게 한다. */
      setSelectedPlacementIndex(nextIndex)
    },
    [fields, onChange, selectedKey, activeOptionValue, selectedPlacementIndex],
  )

  const handleDocumentReady = useCallback((doc: PDFDocumentProxy) => {
    setNumPages(Math.max(1, doc.numPages))
  }, [])

  const selectedField = fields.find((f) => f.fieldKey === selectedKey) ?? null
  const selectedPlacement =
    selectedField && selectedPlacementIndex != null
      ? selectedField.placements[selectedPlacementIndex] ?? null
      : null

  /* 선택된 필드/옵션 정합성 동기화.
     "선택 중 필드가 checkbox/radio 이고, activeOptionValue 가 그 필드의 options 에 없으면"
     첫 옵션으로 재설정한다. 이 동기화가 없으면 필드 전환 후 엉뚱한 옵션 placement 가
     생성될 수 있다. */
  useEffect(() => {
    if (
      !selectedField ||
      (selectedField.fieldType !== 'radio' && selectedField.fieldType !== 'checkbox')
    ) {
      if (activeOptionValue != null) {
        setActiveOptionValue(null)
      }
      return
    }
    const opts = selectedField.options ?? []
    if (activeOptionValue == null || !opts.includes(activeOptionValue)) {
      setActiveOptionValue(opts[0] ?? null)
    }
    /* selectedKey 가 바뀔 때만 재평가. options 가 바뀌면 handlePatchFieldOptions 에서 직접 맞춘다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey])

  /** 박스 모드로 드래그 픽을 받는다. 이는 필드가 선택되어 있을 때만 활성화. */
  const canvasClickEnabled = Boolean(selectedKey)

  return (
    <div className="pdf-engine-editor">
      <aside className="pdf-engine-editor__panel pdf-engine-editor__panel--fields">
        <h3 className="pdf-engine-editor__panel-title">등록된 필드 ({fields.length})</h3>
        {fields.length === 0 ? (
          <p className="pdf-engine-editor__hint">아직 필드가 없습니다.</p>
        ) : (
          <div className="pdf-engine-editor__field-cards">
            {fields.map((f) => {
              const active = f.fieldKey === selectedKey
              const pickField = () => {
                setSelectedKey(f.fieldKey)
                setSelectedPlacementIndex(f.placements.length > 0 ? 0 : null)
              }
              return (
                <div
                  key={f.fieldKey}
                  role="button"
                  tabIndex={0}
                  className={
                    'pdf-engine-editor__field-card' +
                    (active ? ' pdf-engine-editor__field-card--active' : '')
                  }
                  onClick={pickField}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      pickField()
                    }
                  }}
                >
                  <div className="pdf-engine-editor__field-card-main">
                    <div className="pdf-engine-editor__field-card-title">{f.label}</div>
                    <div className="pdf-engine-editor__field-card-meta">
                      {PDF_FIELD_TYPE_LABELS[f.fieldType]} · {f.required ? '필수' : '선택'} · 좌표{' '}
                      {f.placements.length}개
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pdf-engine-editor__btn pdf-engine-editor__btn--danger pdf-engine-editor__field-card-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveField(f.fieldKey)
                    }}
                  >
                    삭제
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </aside>

      <aside className="pdf-engine-editor__panel pdf-engine-editor__panel--config">
        <section
          className="pdf-engine-editor__config-block pdf-engine-editor__config-block--add-field"
          aria-label="새 필드 추가"
        >
          <h3 className="pdf-engine-editor__panel-title">새 필드 추가</h3>
          <div className="pdf-engine-editor__row">
            <label className="pdf-engine-editor__label">
              라벨 (사용자에게 보이는 이름)
              <input
                type="text"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="예: 성명"
              />
            </label>
          </div>
          <div className="pdf-engine-editor__row pdf-engine-editor__row--type-required">
            <label className="pdf-engine-editor__label pdf-engine-editor__label--field-type">
              타입
              <select
                value={draft.fieldType}
                onChange={(e) => setDraft({ ...draft, fieldType: e.target.value as PdfFieldType })}
              >
                {PDF_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PDF_FIELD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="pdf-engine-editor__label pdf-engine-editor__label--checkbox-inline">
              필수
              <input
                type="checkbox"
                className="pdf-engine-editor__input--checkbox-inline"
                checked={draft.required}
                onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
              />
            </label>
          </div>
          <div className="pdf-engine-editor__define-actions pdf-engine-editor__define-actions--add-only">
            <button
              type="button"
              className="pdf-engine-editor__btn pdf-engine-editor__btn--primary"
              onClick={handleAddField}
              disabled={!draft.label.trim()}
            >
              필드 추가
            </button>
          </div>
        </section>

        <div className="pdf-engine-editor__config-divider" role="presentation" />

        <section
          className="pdf-engine-editor__config-block pdf-engine-editor__config-block--selected-field"
          aria-label="선택한 필드 설정"
        >
          {selectedField ? (
            <>
              <h3 className="pdf-engine-editor__panel-title">선택한 필드 설정</h3>
              <p className="pdf-engine-editor__config-selected-name">{selectedField.label}</p>
              <div className="pdf-engine-editor__selected-save-row">
                <button
                  type="button"
                  className="pdf-engine-editor__btn pdf-engine-editor__btn--primary"
                  onClick={onSaveFields}
                  disabled={savingFields || !fieldsDirty}
                >
                  {savingFields ? '좌표 저장 중…' : '좌표 저장'}
                </button>
              </div>
              <p className="pdf-engine-editor__hint">
                PDF 미리보기에서 드래그해 박스를 그리면 위치와 크기가 반영됩니다. 좌표 숫자는 PDF
                위 박스로만 확인합니다.
              </p>
              <label className="pdf-engine-editor__label">
                라벨
                <input
                  type="text"
                  value={selectedField.label}
                  onChange={(e) => handlePatchField(selectedField.fieldKey, { label: e.target.value })}
                />
              </label>
              <div className="pdf-engine-editor__row pdf-engine-editor__row--type-required">
                <label className="pdf-engine-editor__label pdf-engine-editor__label--field-type">
                  타입
                  <select
                    value={selectedField.fieldType}
                    onChange={(e) =>
                      handlePatchField(selectedField.fieldKey, {
                        fieldType: e.target.value as PdfFieldType,
                      })
                    }
                  >
                    {PDF_FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {PDF_FIELD_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pdf-engine-editor__label pdf-engine-editor__label--checkbox-inline">
                  필수
                  <input
                    type="checkbox"
                    className="pdf-engine-editor__input--checkbox-inline"
                    checked={selectedField.required}
                    onChange={(e) =>
                      handlePatchField(selectedField.fieldKey, { required: e.target.checked })
                    }
                  />
                </label>
              </div>

              {selectedField.fieldType === 'signature' ? (
                <p className="pdf-engine-editor__hint" style={{ marginTop: 6 }}>
                  손사인 위치만 지정합니다. 실제 서명은 전자서명 링크에서 작성합니다.
                </p>
              ) : null}

              {selectedField.fieldType === 'text' || selectedField.fieldType === 'textarea' ? (
                <p className="pdf-engine-editor__hint" style={{ marginTop: 6 }}>
                  여기에서는 필드명·타입·PDF 위 박스 영역 중심으로 지정하면 됩니다. 글자 크기는 신청 입력
                  화면에서 필드별로 조절하며, 기본은 11pt 입니다.
                </p>
              ) : null}

              {selectedField.fieldType === 'radio' ? (
                <p className="pdf-engine-editor__hint" style={{ marginTop: 6 }}>
                  각 옵션 박스는 실제로 원 표시가 들어갈 작은 영역을 기준으로 잡습니다(텍스트 라벨 전체를
                  박스로 크게 잡을 필요 없음).
                </p>
              ) : null}

              {selectedField.fieldType === 'radio' || selectedField.fieldType === 'checkbox' ? (
                <RadioOptionsEditor
                  options={selectedField.options ?? []}
                  activeOption={activeOptionValue}
                  onActiveChange={setActiveOptionValue}
                  onOptionsChange={(next) => handlePatchFieldOptions(selectedField.fieldKey, next)}
                  mode={selectedField.fieldType}
                />
              ) : null}

              <h4 className="pdf-engine-editor__panel-title" style={{ marginTop: 8, fontSize: 13 }}>
                좌표 목록
              </h4>
              {selectedField.fieldType === 'checkbox' || selectedField.fieldType === 'radio' ? (
                <div className="pdf-engine-editor__row" style={{ marginTop: -4 }}>
                  <button
                    type="button"
                    className="pdf-engine-editor__btn"
                    onClick={() => setSelectedPlacementIndex(null)}
                  >
                    새 좌표 추가
                  </button>
                  <span className="pdf-engine-editor__field-meta">
                    체크/라디오는 필요 시 여러 좌표를 추가할 수 있습니다.
                  </span>
                </div>
              ) : null}
              {selectedField.placements.length === 0 ? (
                <p className="pdf-engine-editor__hint">
                  아직 좌표가 없습니다. 오른쪽 PDF 위를 드래그해 추가하세요.
                </p>
              ) : (
                <ul className="pdf-engine-editor__fields">
                  {selectedField.placements.map((p, i) => {
                    const isActive = i === selectedPlacementIndex
                    const geomKind =
                      p.width != null && p.height != null ? '영역 박스' : '위치 표시'
                    const metaBits = [`페이지 ${p.page + 1}`, geomKind]
                    if (p.optionValue) metaBits.push(`"${p.optionValue}"`)
                    return (
                      <li
                        key={`${selectedField.fieldKey}-p-${i}`}
                        className={
                          'pdf-engine-editor__field-item' +
                          (isActive ? ' pdf-engine-editor__field-item--active' : '')
                        }
                        onClick={() => setSelectedPlacementIndex(i)}
                      >
                        <div className="pdf-engine-editor__field-item-row">
                          <span className="pdf-engine-editor__field-meta">
                            {metaBits.join(' · ')}
                          </span>
                          <button
                            type="button"
                            className="pdf-engine-editor__btn pdf-engine-editor__btn--danger"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemovePlacement(selectedField.fieldKey, i)
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {SHOW_PLACEMENT_NUMERIC_EDITOR && selectedPlacement ? (
                <PlacementMetaEditor
                  placement={selectedPlacement}
                  onPatch={(patch) =>
                    handlePatchPlacement(
                      selectedField.fieldKey,
                      selectedPlacementIndex as number,
                      patch,
                    )
                  }
                />
              ) : null}
            </>
          ) : (
            <>
              {fieldsDirty ? (
                <div className="pdf-engine-editor__selected-save-row">
                  <button
                    type="button"
                    className="pdf-engine-editor__btn pdf-engine-editor__btn--primary"
                    onClick={onSaveFields}
                    disabled={savingFields}
                  >
                    {savingFields ? '좌표 저장 중…' : '좌표 저장'}
                  </button>
                </div>
              ) : null}
              <p className="pdf-engine-editor__hint pdf-engine-editor__hint--muted-block">
                왼쪽에서 필드를 선택하면 세부 설정과 좌표 저장을 할 수 있습니다.
              </p>
            </>
          )}
        </section>
      </aside>

      <section className="pdf-engine-editor__panel pdf-engine-editor__panel--preview">
        <p className="pdf-engine-editor__hint pdf-engine-editor__preview-hint">
          필드를 고른 뒤 PDF 위에서 드래그하면 박스가 생깁니다. 좌표는 박스 위치로만 확인합니다.
        </p>
        <p className="pdf-engine-editor__hint pdf-engine-editor__preview-hint" style={{ marginTop: 6 }}>
          페이지가 여러 장이면 아래 미리보기를 스크롤하며 작업하세요. A4에 가까운 크기로 표시됩니다.
        </p>
        <div className="pdf-engine-editor__row">
          <label className="pdf-engine-editor__label" style={{ flex: '0 0 160px' }}>
            페이지 (1~{numPages})
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageIndex + 1}
              onChange={(e) => {
                const raw = Number(e.target.value)
                const pageNo =
                  Number.isFinite(raw) && !Number.isNaN(raw) ? Math.trunc(raw) : 1
                const clamped = Math.max(1, Math.min(numPages, pageNo || 1))
                setPageIndex(clamped - 1)
              }}
            />
          </label>
          <span className="pdf-engine-editor__field-meta">
            {selectedField
              ? `선택됨: ${selectedField.label} — PDF 위를 드래그해 박스를 지정하세요`
              : '먼저 왼쪽에서 필드를 선택해 주세요.'}
          </span>
        </div>
        <div className="pdf-engine-editor__preview-scroll">
          <PdfOverlayCanvas
            pdfBuffer={pdfBuffer}
            pageIndex={pageIndex}
            marks={marks}
            clickEnabled={canvasClickEnabled}
            onPick={handlePick}
            onSelectMark={(markId) => {
              const splitAt = markId.lastIndexOf('-')
              if (splitAt <= 0) return
              const key = markId.slice(0, splitAt)
              const rawIndex = Number(markId.slice(splitAt + 1))
              if (!Number.isInteger(rawIndex) || rawIndex < 0) return
              setSelectedKey(key)
              setSelectedPlacementIndex(rawIndex)
            }}
            onDocumentReady={handleDocumentReady}
            debugMeta={overlayDebugMeta}
            mode="pick-box"
          />
        </div>
      </section>
    </div>
  )
}

/**
 * 선택된 placement 의 박스 메타(width/height/fontSize/align) 편집 패널.
 *
 * 이 서브컴포넌트를 분리한 이유:
 *   - 편집 로직은 "입력 문자열 → 숫자 파싱 → patch" 라는 하나의 책임만 가진다.
 *   - PdfCoordinateEditor 본체는 필드 단위 상태 관리에 집중한다.
 *   - 후속 PR 에서 드래그 핸들/리사이즈를 붙일 때도 이 패널을 그대로 유지한다.
 */
interface PlacementMetaEditorProps {
  placement: PdfPlacement
  onPatch: (patch: Partial<PdfPlacement>) => void
}

function PlacementMetaEditor({ placement, onPatch }: PlacementMetaEditorProps) {
  const handleNumericChange = (key: 'width' | 'height' | 'fontSize') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseOptionalPositive(e.target.value)
    if (parsed === 'invalid') return
    onPatch({ [key]: parsed } as Partial<PdfPlacement>)
  }

  return (
    <div style={{ marginTop: 4 }}>
      <h4 className="pdf-engine-editor__panel-title" style={{ marginTop: 8, fontSize: 13 }}>
        선택된 좌표 설정
      </h4>
      <div className="pdf-engine-editor__row">
        <label className="pdf-engine-editor__label">
          너비 (pt)
          <FormInput
            type="number"
            min={0}
            step={1}
            value={numericInputValue(placement.width)}
            onChange={handleNumericChange('width')}
            placeholder="비워두면 자동"
          />
        </label>
        <label className="pdf-engine-editor__label">
          높이 (pt)
          <FormInput
            type="number"
            min={0}
            step={1}
            value={numericInputValue(placement.height)}
            onChange={handleNumericChange('height')}
            placeholder="비워두면 자동"
          />
        </label>
      </div>
      <div className="pdf-engine-editor__row">
        <label className="pdf-engine-editor__label">
          글자 크기 (pt, 선택 입력)
          <FormInput
            type="number"
            min={0}
            step={1}
            value={numericInputValue(placement.fontSize)}
            onChange={handleNumericChange('fontSize')}
            placeholder="비우면 기본값(신청 입력 11pt)"
          />
        </label>
      </div>
      <p className="pdf-engine-editor__hint" style={{ margin: '4px 0 0' }}>
        텍스트는 좌표 박스 중앙 정렬로 출력됩니다.
      </p>
    </div>
  )
}

/**
 * radio 필드의 옵션 목록 편집 + "현재 편집 중 옵션" 선택 UI.
 *
 * 설계 의도:
 *   - 옵션 입력은 별도 서브컴포넌트로 분리해 radio 가 아닌 타입에서는 import 자체가 동작하지 않는 코드가
 *     실행되지 않도록 한다(관심사 분리).
 *   - "활성 옵션(activeOption)" 개념은 "새 placement 가 대표할 옵션" 을 의미한다. 편집 흐름:
 *     옵션을 하나 고르고 → PDF 위를 드래그하면 그 옵션의 체크 박스가 생긴다. 각 옵션마다
 *     이 동작을 반복해 선택지 개수만큼 placement 를 만든다.
 */
interface RadioOptionsEditorProps {
  options: string[]
  activeOption: string | null
  onActiveChange: (next: string | null) => void
  onOptionsChange: (next: string[]) => void
  mode: 'radio' | 'checkbox'
}

function RadioOptionsEditor({
  options,
  activeOption,
  onActiveChange,
  onOptionsChange,
  mode,
}: RadioOptionsEditorProps) {
  const [draft, setDraft] = useState('')

  const handleAdd = () => {
    const v = draft.trim()
    if (!v) return
    if (options.includes(v)) {
      setDraft('')
      return
    }
    onOptionsChange([...options, v])
    onActiveChange(v)
    setDraft('')
  }

  const handleRemove = (target: string) => {
    const next = options.filter((o) => o !== target)
    onOptionsChange(next)
  }

  const handleRename = (index: number, nextValue: string) => {
    const trimmed = nextValue.trim()
    /* 중복 값 입력은 저장하지 않는다 — 같은 옵션 2개는 업무상 의미가 없다. */
    if (!trimmed || options.some((o, i) => i !== index && o === trimmed)) return
    const next = options.map((o, i) => (i === index ? trimmed : o))
    /* 현재 활성 옵션이 이름변경 대상이라면 활성 값도 갱신해 placement 생성 시 일관성 유지. */
    if (activeOption === options[index]) onActiveChange(trimmed)
    onOptionsChange(next)
  }

  return (
    <div style={{ marginTop: 8 }}>
      <h4 className="pdf-engine-editor__panel-title" style={{ marginTop: 8, fontSize: 13 }}>
        {mode === 'radio' ? '라디오 옵션' : '체크박스 옵션'} ({options.length})
      </h4>
      <p className="pdf-engine-editor__hint" style={{ margin: '0 0 6px' }}>
        옵션을 선택하고 PDF 위를 드래그하면, 해당 라벨 전용 좌표가 추가됩니다.
      </p>
      {options.length === 0 ? (
        <p className="pdf-engine-editor__hint">아직 옵션이 없습니다.</p>
      ) : (
        <ul className="pdf-engine-editor__fields">
          {options.map((opt, i) => (
            <li
              key={`${opt}-${i}`}
              className={
                'pdf-engine-editor__field-item' +
                (opt === activeOption ? ' pdf-engine-editor__field-item--active' : '')
              }
              onClick={() => onActiveChange(opt)}
            >
              <div className="pdf-engine-editor__field-item-row">
                <FormInput
                  type="text"
                  value={opt}
                  onChange={(e) => handleRename(i, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  className="pdf-engine-editor__btn pdf-engine-editor__btn--danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(opt)
                  }}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="pdf-engine-editor__row" style={{ marginTop: 4 }}>
        <FormInput
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="새 옵션 이름"
        />
        <button
          type="button"
          className="pdf-engine-editor__btn pdf-engine-editor__btn--primary"
          onClick={handleAdd}
          disabled={!draft.trim()}
        >
          옵션 추가
        </button>
      </div>
    </div>
  )
}
