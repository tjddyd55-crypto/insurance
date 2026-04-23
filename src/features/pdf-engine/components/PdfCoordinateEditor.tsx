/**
 * 관리자 좌표 에디터.
 *
 * UX 원칙: "라벨 우선".
 *   1) 왼쪽 패널에서 라벨·타입·필수만 입력해 필드를 정의한다.
 *      (내부 식별자 `fieldKey` 는 라벨에서 자동 파생 — 관리자가 다룰 필요 없음.)
 *   2) 원하는 필드를 선택한 상태로 오른쪽 PDF 를 클릭 → placement 1개가 추가된다.
 *   3) placement 는 배열이므로 한 필드가 문서 내 여러 위치를 차지할 수 있다(예: 2p 서명).
 *
 * 저장 형식:
 *   - 좌표는 PDF 포인트(원점 좌하단). 해상도 무관.
 *   - 호출측(페이지 컴포넌트) 이 이 필드 배열을 서버 API 로 PUT 한다.
 *
 * 이 컴포넌트 자체는 I/O 를 하지 않는다 — 입력(fields)과 출력(onChange)만으로 동작.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PdfFieldSpec, PdfFieldType, PdfPlacement } from '../types'
import { PDF_FIELD_TYPES } from '../types'
import { PdfOverlayCanvas, type OverlayMark, type OverlayPick } from './PdfOverlayCanvas'

interface Props {
  pdfBuffer: ArrayBuffer | null
  pageCount: number
  fields: PdfFieldSpec[]
  onChange: (next: PdfFieldSpec[]) => void
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

function genKeyFromLabel(label: string, existing: ReadonlySet<string>): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'field'
  if (!existing.has(base)) return base
  for (let i = 2; i < 200; i += 1) {
    const candidate = `${base}_${i}`
    if (!existing.has(candidate)) return candidate
  }
  return `${base}_${Date.now().toString(36)}`
}

export function PdfCoordinateEditor({ pdfBuffer, pageCount, fields, onChange }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftField>(EMPTY_DRAFT)
  const [pageIndex, setPageIndex] = useState(0)
  const [numPages, setNumPages] = useState(pageCount > 0 ? pageCount : 1)

  useEffect(() => {
    if (pageCount > 0) setNumPages(pageCount)
  }, [pageCount])

  const existingKeys = useMemo(() => new Set(fields.map((f) => f.fieldKey)), [fields])

  /** 왼쪽 필드 목록의 placement 들을 overlay 마커로 변환.
      마커 라벨은 사용자가 실제로 다루는 값(`label`) 을 쓴다 — 내부 key 는 노출하지 않는다. */
  const marks: OverlayMark[] = useMemo(() => {
    const out: OverlayMark[] = []
    for (const f of fields) {
      for (let i = 0; i < f.placements.length; i += 1) {
        const p = f.placements[i]
        out.push({
          id: `${f.fieldKey}-${i}`,
          pageIndex: p.page,
          x: p.x,
          y: p.y,
          label: f.label || `필드 ${f.orderIndex + 1}`,
          selected: f.fieldKey === selectedKey,
        })
      }
    }
    return out
  }, [fields, selectedKey])

  const handleAddField = () => {
    const labelTrim = draft.label.trim()
    if (!labelTrim) return
    /* 내부 식별자는 라벨에서 자동 파생. 같은 템플릿 내 충돌은 genKeyFromLabel 이
       suffix 로 회피하므로 사용자는 식별자를 의식할 필요가 없다. */
    const key = genKeyFromLabel(labelTrim, existingKeys)
    const next: PdfFieldSpec = {
      fieldKey: key,
      label: labelTrim,
      fieldType: draft.fieldType,
      required: draft.required,
      orderIndex: fields.length,
      customerMapping: null,
      placements: [],
    }
    onChange([...fields, next])
    setSelectedKey(key)
    setDraft(EMPTY_DRAFT)
  }

  const handleRemoveField = (key: string) => {
    if (!window.confirm('해당 필드를 삭제할까요? 모든 좌표도 함께 제거됩니다.')) return
    const next = fields.filter((f) => f.fieldKey !== key).map((f, i) => ({ ...f, orderIndex: i }))
    onChange(next)
    if (selectedKey === key) setSelectedKey(null)
  }

  const handlePatchField = (key: string, patch: Partial<PdfFieldSpec>) => {
    onChange(fields.map((f) => (f.fieldKey === key ? { ...f, ...patch } : f)))
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
  }

  const handlePick = useCallback(
    (pick: OverlayPick) => {
      if (!selectedKey) {
        window.alert('먼저 왼쪽에서 필드를 선택한 뒤 PDF 위를 클릭하세요.')
        return
      }
      const placement: PdfPlacement = {
        page: pick.pageIndex,
        x: pick.x,
        y: pick.y,
        width: null,
        height: null,
        fontSize: null,
        align: 'left',
      }
      onChange(
        fields.map((f) =>
          f.fieldKey === selectedKey
            ? { ...f, placements: [...f.placements, placement] }
            : f,
        ),
      )
    },
    [fields, onChange, selectedKey],
  )

  const handleDocumentReady = useCallback((doc: PDFDocumentProxy) => {
    setNumPages(Math.max(1, doc.numPages))
  }, [])

  const selectedField = fields.find((f) => f.fieldKey === selectedKey) ?? null

  return (
    <div className="pdf-engine-editor">
      <aside className="pdf-engine-editor__panel">
        <h3 className="pdf-engine-editor__panel-title">필드 정의</h3>
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
        <div className="pdf-engine-editor__row">
          <label className="pdf-engine-editor__label">
            타입
            <select
              value={draft.fieldType}
              onChange={(e) => setDraft({ ...draft, fieldType: e.target.value as PdfFieldType })}
            >
              {PDF_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="pdf-engine-editor__label" style={{ flex: '0 0 auto' }}>
            필수
            <input
              type="checkbox"
              checked={draft.required}
              onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
              style={{ width: 'auto' }}
            />
          </label>
        </div>
        <button
          type="button"
          className="pdf-engine-editor__btn pdf-engine-editor__btn--primary"
          onClick={handleAddField}
          disabled={!draft.label.trim()}
        >
          필드 추가
        </button>

        <h3 className="pdf-engine-editor__panel-title" style={{ marginTop: 8 }}>
          등록된 필드 ({fields.length})
        </h3>
        {fields.length === 0 ? (
          <p className="pdf-engine-editor__hint">아직 필드가 없습니다.</p>
        ) : (
          <ul className="pdf-engine-editor__fields">
            {fields.map((f) => (
              <li
                key={f.fieldKey}
                className={
                  'pdf-engine-editor__field-item' +
                  (f.fieldKey === selectedKey ? ' pdf-engine-editor__field-item--active' : '')
                }
                onClick={() => setSelectedKey(f.fieldKey)}
              >
                <div className="pdf-engine-editor__field-item-row">
                  <strong>{f.label}</strong>
                </div>
                <div className="pdf-engine-editor__field-item-row">
                  <span className="pdf-engine-editor__field-meta">
                    {f.fieldType}
                    {f.required ? ' · 필수' : ''}
                    {' · 좌표 '}
                    {f.placements.length}
                    개
                  </span>
                  <button
                    type="button"
                    className="pdf-engine-editor__btn pdf-engine-editor__btn--danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveField(f.fieldKey)
                    }}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {selectedField ? (
          <>
            <h3 className="pdf-engine-editor__panel-title" style={{ marginTop: 8 }}>
              선택된 필드: {selectedField.label}
            </h3>
            <p className="pdf-engine-editor__hint">
              PDF 위를 클릭하면 이 필드의 위치가 추가됩니다.
            </p>
            <label className="pdf-engine-editor__label">
              라벨
              <input
                type="text"
                value={selectedField.label}
                onChange={(e) => handlePatchField(selectedField.fieldKey, { label: e.target.value })}
              />
            </label>
            <label className="pdf-engine-editor__label">
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
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="pdf-engine-editor__label" style={{ flex: '0 0 auto' }}>
              필수
              <input
                type="checkbox"
                checked={selectedField.required}
                onChange={(e) =>
                  handlePatchField(selectedField.fieldKey, { required: e.target.checked })
                }
                style={{ width: 'auto' }}
              />
            </label>

            <h4 className="pdf-engine-editor__panel-title" style={{ marginTop: 8, fontSize: 13 }}>
              좌표 목록
            </h4>
            {selectedField.placements.length === 0 ? (
              <p className="pdf-engine-editor__hint">아직 좌표가 없습니다. PDF 를 클릭해 추가하세요.</p>
            ) : (
              <ul className="pdf-engine-editor__fields">
                {selectedField.placements.map((p, i) => (
                  <li key={`${selectedField.fieldKey}-p-${i}`} className="pdf-engine-editor__field-item">
                    <div className="pdf-engine-editor__field-item-row">
                      <span className="pdf-engine-editor__field-meta">
                        p{p.page + 1} · x={p.x.toFixed(1)}, y={p.y.toFixed(1)}
                        {p.fontSize ? `, ${p.fontSize}pt` : ''}
                      </span>
                      <button
                        type="button"
                        className="pdf-engine-editor__btn pdf-engine-editor__btn--danger"
                        onClick={() => handleRemovePlacement(selectedField.fieldKey, i)}
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </aside>

      <section className="pdf-engine-editor__panel">
        <div className="pdf-engine-editor__row">
          <label className="pdf-engine-editor__label" style={{ flex: '0 0 160px' }}>
            페이지 (1~{numPages})
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageIndex + 1}
              onChange={(e) =>
                setPageIndex(Math.max(0, Math.min(numPages - 1, (Number(e.target.value) || 1) - 1)))
              }
            />
          </label>
          <span className="pdf-engine-editor__field-meta">
            {selectedField ? `선택됨: ${selectedField.label}` : '필드를 선택해 주세요.'}
          </span>
        </div>
        <PdfOverlayCanvas
          pdfBuffer={pdfBuffer}
          pageIndex={pageIndex}
          marks={marks}
          clickEnabled={Boolean(selectedKey)}
          onPick={handlePick}
          onDocumentReady={handleDocumentReady}
        />
      </section>
    </div>
  )
}
