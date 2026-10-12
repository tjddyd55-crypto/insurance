import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormDialog } from '../../../../components/dialog'
import { LoadingState } from '../../../../components/feedback'
import { FieldWrapper, FormButton, FormInput } from '../../../../components/form'
import type { GaGroupSearchGaRow } from '../../api/gaGroupApi'

const PAGE_SIZE = 8

type Props = {
  open: boolean
  groupId: number
  groupName: string
  busy: boolean
  onClose: () => void
  onSearch: (query: string) => Promise<GaGroupSearchGaRow[]>
  onLink: (gaIds: number[], confirmMove: boolean) => Promise<boolean>
}

export function GaGroupLinkGaModal({
  open,
  groupId,
  groupName,
  busy,
  onClose,
  onSearch,
  onLink,
}: Props) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<GaGroupSearchGaRow[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [page, setPage] = useState(0)

  const runSearch = useCallback(async () => {
    setSearching(true)
    try {
      const list = await onSearch(query)
      setRows(list)
      setPage(0)
      setSelected(new Set())
    } finally {
      setSearching(false)
    }
  }, [onSearch, query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setRows([])
      setSelected(new Set())
      setPage(0)
      return
    }
    const timer = window.setTimeout(() => {
      void runSearch()
    }, 200)
    return () => window.clearTimeout(timer)
  }, [open, query, runSearch])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [page, rows])

  const toggle = (id: number, linkedHere: boolean) => {
    if (linkedHere) {
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const submit = async () => {
    const ids = [...selected]
    if (ids.length === 0) {
      return
    }
    const needsMove = rows.some((r) => ids.includes(r.id) && r.inOtherGroup)
    const ok = await onLink(ids, needsMove)
    if (ok) {
      onClose()
    }
  }

  return (
    <FormDialog
      open={open}
      title="GA 연결"
      onClose={() => !busy && onClose()}
      disableClose={busy}
      footer={
        <div className="ga-group-link-modal__footer">
          <FormButton type="button" variant="secondary" disabled={busy} onClick={onClose}>
            취소
          </FormButton>
          <FormButton type="button" disabled={busy || selected.size === 0} onClick={() => void submit()}>
            선택 GA 연결 ({selected.size})
          </FormButton>
        </div>
      }
    >
      <p className="ga-group-link-modal__desc">
        「{groupName}」에 연결할 GA를 검색해 선택하세요. 다른 그룹에 속한 GA는 연결 시 이동 확인이 필요합니다.
      </p>
      <FieldWrapper label="검색">
        <FormInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="GA 이름 또는 코드"
          autoFocus
        />
      </FieldWrapper>

      {searching ?
        <LoadingState message="검색 중…" />
      : <div className="ga-group-link-modal__list-wrap">
          <ul className="ga-group-link-modal__list">
            {pageRows.map((row) => {
              const linkedHere = row.groupId === groupId
              const checked = selected.has(row.id)
              return (
                <li key={row.id} className="ga-group-link-modal__row">
                  <label className="ga-group-link-modal__label">
                    <FormInput
                      type="checkbox"
                      checked={linkedHere || checked}
                      disabled={linkedHere || busy}
                      onChange={() => toggle(row.id, linkedHere)}
                      className="shrink-0"
                    />
                    <span className="ga-group-link-modal__name">
                      {row.name}
                      <span className="ga-group-link-modal__code">{row.code}</span>
                    </span>
                  </label>
                  {linkedHere ?
                    <span className="ga-group-link-modal__badge ga-group-link-modal__badge--here">이 그룹</span>
                  : row.groupName ?
                    <span className="ga-group-link-modal__badge">{row.groupName}</span>
                  : null}
                </li>
              )
            })}
          </ul>
          {rows.length > PAGE_SIZE ?
            <div className="ga-group-link-modal__pager">
              <FormButton
                type="button"
                variant="secondary"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                이전
              </FormButton>
              <span className="ga-group-link-modal__pager-meta">
                {page + 1} / {pageCount}
              </span>
              <FormButton
                type="button"
                variant="secondary"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                다음
              </FormButton>
            </div>
          : null}
        </div>
      }
    </FormDialog>
  )
}
