import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FormInput } from '../../../components/form'
import {
  searchPublicGaGroupGas,
  type PublicGaGroupGa,
} from '../../admin/api/gaGroupApi'

type Props = {
  groupSlug: string
  groupName: string
  value: PublicGaGroupGa | null
  onChange: (next: PublicGaGroupGa | null) => void
  onGaCodeChange: (code: string, displayName: string) => void
  disabled?: boolean
}

export function GaGroupBranchCombobox({
  groupSlug,
  groupName,
  value,
  onChange,
  onGaCodeChange,
  disabled = false,
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<PublicGaGroupGa[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    if (!open || !groupSlug) {
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        const rows = await searchPublicGaGroupGas(groupSlug, query)
        if (!cancelled) {
          setOptions(rows)
          setHighlight(0)
          setLoading(false)
        }
      })()
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [groupSlug, open, query])

  useEffect(() => {
    const onDocPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current
      if (!el || !open) {
        return
      }
      const target = e.target
      if (target instanceof Node && !el.contains(target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('touchstart', onDocPointer)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('touchstart', onDocPointer)
    }
  }, [open])

  const selectOption = useCallback(
    (row: PublicGaGroupGa) => {
      onChange(row)
      onGaCodeChange(row.code, row.name)
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
    },
    [onChange, onGaCodeChange],
  )

  const openDropdown = () => {
    if (disabled) {
      return
    }
    setOpen(true)
    setQuery('')
  }

  const inputDisplay = open ? query : value ? `${value.name} (${value.code})` : ''

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault()
      openDropdown()
      return
    }
    if (!open) {
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(0, options.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter' && options[highlight]) {
      e.preventDefault()
      selectOption(options[highlight])
    }
  }

  return (
    <div ref={rootRef} className="ga-group-combobox field">
      <span className="field__label">소속 지점</span>
      <p className="ga-group-combobox__hint">{groupName}에 연결된 지점만 선택할 수 있습니다.</p>
      <div className="ga-group-combobox__control">
        <FormInput
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[highlight] ? `${listId}-opt-${options[highlight].id}` : undefined}
          value={inputDisplay}
          placeholder={value ? undefined : '지점명 또는 GA 코드 검색'}
          autoComplete="off"
          disabled={disabled}
          onFocus={openDropdown}
          onClick={openDropdown}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) {
              setOpen(true)
            }
            if (value) {
              onChange(null)
              onGaCodeChange('', '')
            }
          }}
          onKeyDown={onInputKeyDown}
        />
        {open ?
          <ul id={listId} className="ga-group-combobox__list" role="listbox">
            {loading ?
              <li className="ga-group-combobox__empty">검색 중…</li>
            : options.length === 0 ?
              <li className="ga-group-combobox__empty">검색 결과가 없습니다.</li>
            : options.map((row, index) => (
                <li key={row.id} role="presentation">
                  <button
                    id={`${listId}-opt-${row.id}`}
                    type="button"
                    role="option"
                    aria-selected={highlight === index}
                    className={`ga-group-combobox__option${highlight === index ? ' ga-group-combobox__option--active' : ''}`}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => selectOption(row)}
                  >
                    <span className="ga-group-combobox__option-name">{row.name}</span>
                    <span className="ga-group-combobox__option-code">{row.code}</span>
                  </button>
                </li>
              ))
            }
          </ul>
        : null}
      </div>
    </div>
  )
}
