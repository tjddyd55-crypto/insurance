import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import FormInput from '../form/FormInput'
import { Button } from '../ui'
import {
  clampHour12,
  clampMinute,
  digitsOnly,
  formatKoreanClock,
  pad2,
  parseHm24,
  readDraftNumber,
  shiftHour12,
  shiftMinute,
  toHm24,
  type ClockParts,
} from '../../utils/timeInput'

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** 닫힌 칸의 접근성 이름. 예: 시작 시간 */
  ariaLabel?: string
}

const FALLBACK_CLOCK: ClockParts = { hour12: 9, minute: 0, meridiem: 'am' }

function clockOf(value: string): ClockParts {
  return parseHm24(value) ?? FALLBACK_CLOCK
}

function TimeGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  )
}

function onDisplayKeyDown(event: KeyboardEvent<HTMLInputElement>, disabled: boolean, openPanel: () => void) {
  if (disabled) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  openPanel()
}

function closeOnEscape(
  event: { key: string; preventDefault: () => void; stopPropagation: () => void },
  onClose: () => void,
) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  onClose()
}

type ClockRecipe = (prev: ClockParts) => ClockParts

type PanelProps = {
  id: string
  hourRef: RefObject<HTMLInputElement | null>
  hourDraft: string
  minuteDraft: string
  parts: ClockParts
  onHourDraft: (value: string) => void
  onMinuteDraft: (value: string) => void
  onCommit: (recipe: ClockRecipe) => void
  onClose: () => void
}

function commitHourDraft(draft: string, parts: ClockParts, onHourDraft: (value: string) => void, onCommit: (recipe: ClockRecipe) => void) {
  const parsed = readDraftNumber(draft)
  if (parsed == null) {
    onHourDraft(String(parts.hour12))
    return
  }
  const hour12 = clampHour12(parsed)
  onHourDraft(String(hour12))
  if (hour12 !== parts.hour12) onCommit((prev) => ({ ...prev, hour12 }))
}

function commitMinuteDraft(draft: string, parts: ClockParts, onMinuteDraft: (value: string) => void, onCommit: (recipe: ClockRecipe) => void) {
  const parsed = readDraftNumber(draft)
  if (parsed == null) {
    onMinuteDraft(pad2(parts.minute))
    return
  }
  const minute = clampMinute(parsed)
  onMinuteDraft(pad2(minute))
  if (minute !== parts.minute) onCommit((prev) => ({ ...prev, minute }))
}

function onHourKey(event: KeyboardEvent<HTMLInputElement>, parts: ClockParts, onHourDraft: (value: string) => void, onCommit: (recipe: ClockRecipe) => void, onClose: () => void) {
  if (event.key === 'Escape') {
    closeOnEscape(event, onClose)
    return
  }
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  event.preventDefault()
  const hour12 = shiftHour12(parts.hour12, event.key === 'ArrowUp' ? 1 : -1)
  onHourDraft(String(hour12))
  onCommit((prev) => ({ ...prev, hour12 }))
}

function onMinuteKey(event: KeyboardEvent<HTMLInputElement>, parts: ClockParts, onMinuteDraft: (value: string) => void, onCommit: (recipe: ClockRecipe) => void, onClose: () => void) {
  if (event.key === 'Escape') {
    closeOnEscape(event, onClose)
    return
  }
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  event.preventDefault()
  const minute = shiftMinute(parts.minute, event.key === 'ArrowUp' ? 1 : -1)
  onMinuteDraft(pad2(minute))
  onCommit((prev) => ({ ...prev, minute }))
}

function TimePanel({ id, hourRef, hourDraft, minuteDraft, parts, onHourDraft, onMinuteDraft, onCommit, onClose }: PanelProps) {
  const onHourChange = (raw: string) => {
    const digits = digitsOnly(raw, 2)
    onHourDraft(digits)
    const hour = readDraftNumber(digits)
    if (hour == null || hour < 1 || hour > 12) return
    onCommit((prev) => ({ ...prev, hour12: hour }))
  }

  const onMinuteChange = (raw: string) => {
    const digits = digitsOnly(raw, 2)
    onMinuteDraft(digits)
    const minute = readDraftNumber(digits)
    if (minute == null || minute > 59) return
    onCommit((prev) => ({ ...prev, minute }))
  }

  return (
    <div id={id} className="app-time-input__panel" role="group" aria-label="시간 선택" onKeyDown={(event) => closeOnEscape(event, onClose)}>
      <div className="app-time-input__part">
        <span className="app-time-input__caption">시</span>
        <FormInput
          ref={hourRef}
          inputMode="numeric"
          autoComplete="off"
          aria-label="시"
          maxLength={2}
          value={hourDraft}
          onChange={(event) => onHourChange(event.target.value)}
          onBlur={() => commitHourDraft(hourDraft, parts, onHourDraft, onCommit)}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => onHourKey(event, parts, onHourDraft, onCommit, onClose)}
        />
      </div>
      <span className="app-time-input__colon" aria-hidden="true">:</span>
      <div className="app-time-input__part">
        <span className="app-time-input__caption">분</span>
        <FormInput
          inputMode="numeric"
          autoComplete="off"
          aria-label="분"
          maxLength={2}
          value={minuteDraft}
          onChange={(event) => onMinuteChange(event.target.value)}
          onBlur={() => commitMinuteDraft(minuteDraft, parts, onMinuteDraft, onCommit)}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => onMinuteKey(event, parts, onMinuteDraft, onCommit, onClose)}
        />
      </div>
      <div className="app-time-input__meridiem" role="group" aria-label="오전 오후">
        <Button type="button" size="sm" variant={parts.meridiem === 'am' ? 'primary' : 'secondary'} aria-pressed={parts.meridiem === 'am'} onClick={() => onCommit((prev) => ({ ...prev, meridiem: 'am' }))}>
          오전
        </Button>
        <Button type="button" size="sm" variant={parts.meridiem === 'pm' ? 'primary' : 'secondary'} aria-pressed={parts.meridiem === 'pm'} onClick={() => onCommit((prev) => ({ ...prev, meridiem: 'pm' }))}>
          오후
        </Button>
      </div>
    </div>
  )
}

export default function AppTimeInput({ value, onChange, disabled = false, ariaLabel = '시간' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const hourRef = useRef<HTMLInputElement>(null)
  const partsRef = useRef<ClockParts>(FALLBACK_CLOCK)
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [parts, setParts] = useState<ClockParts>(FALLBACK_CLOCK)
  const [hourDraft, setHourDraft] = useState('')
  const [minuteDraft, setMinuteDraft] = useState('')
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null)

  const openPanel = () => {
    if (disabled) return
    const base = clockOf(value)
    partsRef.current = base
    setParts(base)
    setHourDraft(String(base.hour12))
    setMinuteDraft(pad2(base.minute))
    setOpen(true)
  }

  const commit = (recipe: ClockRecipe) => {
    const next = recipe(partsRef.current)
    partsRef.current = next
    setParts(next)
    onChange(toHm24(next))
  }

  useEffect(() => {
    if (!open) return
    hourRef.current?.focus()
    hourRef.current?.select()
  }, [open])

  useEffect(() => {
    if (!open) return
    const place = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const margin = 8
      const width = Math.min(Math.max(rect.width, 260), window.innerWidth - margin * 2)
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))
      setAnchor({ top: rect.bottom + 4, left, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (rootRef.current?.contains(event.target)) return
      if (panelRef.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div className={`app-time-input${disabled ? ' app-time-input--disabled' : ''}`} ref={rootRef}>
      <FormInput
        readOnly
        className="app-time-input__display"
        value={formatKoreanClock(value)}
        placeholder="시간 선택"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={openPanel}
        onKeyDown={(event) => onDisplayKeyDown(event, disabled, openPanel)}
      />
      <span className="app-time-input__glyph">
        <TimeGlyph />
      </span>
      {open && anchor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              className="app-time-input__popover"
              style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
            >
              <TimePanel
                id={panelId}
                hourRef={hourRef}
                hourDraft={hourDraft}
                minuteDraft={minuteDraft}
                parts={parts}
                onHourDraft={setHourDraft}
                onMinuteDraft={setMinuteDraft}
                onCommit={commit}
                onClose={() => setOpen(false)}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
