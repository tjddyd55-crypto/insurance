import { FormTextarea } from '../../../components/form'
import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type RefObject } from 'react'
import type { MemoFontWeight, Note } from '../types/memo.types'
import {
  MEMO_DEFAULT_HEIGHT,
  MEMO_DEFAULT_WIDTH,
  MEMO_MIN_HEIGHT,
  MEMO_MIN_WIDTH,
  MEMO_MINIMIZED_HEIGHT,
} from '@insurance-shared/memoLayout.js'

const MIN_W = MEMO_MIN_WIDTH
const MIN_H = MEMO_MIN_HEIGHT
const FONT_MIN = 12
const FONT_MAX = 24

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

function isNoDragTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('[data-no-drag="true"]'))
}

function notePreview(content: string): string {
  const line = content.split('\n')[0]?.trim() ?? ''
  if (line.length > 0) {
    return line.length > 28 ? `${line.slice(0, 28)}…` : line
  }
  return '메모'
}

type Props = {
  note: Note
  isActive: boolean
  isEditing: boolean
  isDragging: boolean
  isMinimized: boolean
  onChange: (content: string) => void
  onPositionCommit: (id: string, x: number, y: number) => void
  onSizeCommit: (id: string, width: number, height: number) => void
  onFontSizeChange: (id: string, fontSize: number) => void
  onFontWeightChange: (id: string, fontWeight: MemoFontWeight) => void
  onToggleMinimize: (id: string) => void
  containerRef: RefObject<HTMLElement | null>
  getWorkspaceBounds: () => { width: number; height: number }
  onDeleteRequest: (id: string) => void
  onRootClick: (id: string) => void
  onActivate: (id: string) => void
  onTextareaFocus: (id: string) => void
  onTextareaBlur: () => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
}

export default function StickyNote({
  note,
  isActive,
  isEditing,
  isDragging,
  isMinimized,
  onChange,
  onPositionCommit,
  onSizeCommit,
  onFontSizeChange,
  onFontWeightChange,
  onToggleMinimize,
  containerRef,
  getWorkspaceBounds,
  onDeleteRequest,
  onRootClick,
  onActivate,
  onTextareaFocus,
  onTextareaBlur,
  onDragStart,
  onDragEnd,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragSessionRef = useRef<{
    pointerId: number
    originX: number
    originY: number
    offsetX: number
    offsetY: number
    bounds: { width: number; height: number }
    noteW: number
    noteH: number
  } | null>(null)
  const resizeSessionRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingPosRef = useRef<{ x: number; y: number } | null>(null)
  const pendingSizeRef = useRef<{ w: number; h: number } | null>(null)

  const w = Math.max(MIN_W, Number(note.width) || MEMO_DEFAULT_WIDTH)
  const storedH = Math.max(MIN_H, Number(note.height) || MEMO_DEFAULT_HEIGHT)
  const displayH = isMinimized ? MEMO_MINIMIZED_HEIGHT : storedH
  const fs = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(Number(note.fontSize) || 16)))
  const isBold = note.fontWeight === 'bold'
  const preview = useMemo(() => notePreview(note.content), [note.content])

  const clearDragVisual = useCallback(() => {
    const el = rootRef.current
    if (!el) {
      return
    }
    el.style.transform = ''
  }, [])

  const applyDragTransform = useCallback((x: number, y: number) => {
    const session = dragSessionRef.current
    const el = rootRef.current
    if (!session || !el) {
      return
    }
    el.style.transform = `translate(${x - session.originX}px, ${y - session.originY}px)`
  }, [])

  const computeClampedPosition = useCallback(
    (clientX: number, clientY: number, session: NonNullable<typeof dragSessionRef.current>) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) {
        return null
      }
      const rawX = clientX - rect.left - session.offsetX
      const rawY = clientY - rect.top - session.offsetY
      const maxX = Math.max(0, session.bounds.width - session.noteW)
      const maxY = Math.max(0, session.bounds.height - session.noteH)
      return {
        x: clamp(rawX, 0, maxX),
        y: clamp(rawY, 0, maxY),
      }
    },
    [containerRef],
  )

  const scheduleDragFrame = useCallback(() => {
    if (rafRef.current != null) {
      return
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const next = pendingPosRef.current
      if (next) {
        applyDragTransform(next.x, next.y)
      }
    })
  }, [applyDragTransform])

  const finishDrag = useCallback(
    (pointerId: number) => {
      const session = dragSessionRef.current
      if (!session || session.pointerId !== pointerId) {
        return
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const next = pendingPosRef.current ?? { x: session.originX, y: session.originY }
      clearDragVisual()
      dragSessionRef.current = null
      pendingPosRef.current = null
      onPositionCommit(note.id, next.x, next.y)
      onDragEnd()
    },
    [clearDragVisual, note.id, onDragEnd, onPositionCommit],
  )

  const handleTitlebarPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (isNoDragTarget(e.target) || resizeSessionRef.current) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    onDragStart(note.id)

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    dragSessionRef.current = {
      pointerId: e.pointerId,
      originX: note.x,
      originY: note.y,
      offsetX: e.clientX - rect.left - note.x,
      offsetY: e.clientY - rect.top - note.y,
      bounds: getWorkspaceBounds(),
      noteW: w,
      noteH: displayH,
    }
    pendingPosRef.current = { x: note.x, y: note.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleTitlebarPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== e.pointerId) {
      return
    }
    e.preventDefault()
    const next = computeClampedPosition(e.clientX, e.clientY, session)
    if (!next) {
      return
    }
    pendingPosRef.current = next
    scheduleDragFrame()
  }

  const handleTitlebarPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    finishDrag(e.pointerId)
  }

  const finishResize = useCallback(
    (pointerId: number) => {
      const session = resizeSessionRef.current
      if (!session || session.pointerId !== pointerId) {
        return
      }
      const el = rootRef.current
      if (el) {
        el.style.width = ''
        el.style.height = ''
      }
      const next = pendingSizeRef.current ?? { w: session.startW, h: session.startH }
      resizeSessionRef.current = null
      pendingSizeRef.current = null
      onSizeCommit(note.id, next.w, next.h)
    },
    [note.id, onSizeCommit],
  )

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragSessionRef.current || isMinimized) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    onActivate(note.id)
    resizeSessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: w,
      startH: storedH,
    }
    pendingSizeRef.current = { w, h: storedH }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = resizeSessionRef.current
    if (!session || session.pointerId !== e.pointerId) {
      return
    }
    e.preventDefault()
    const dx = e.clientX - session.startX
    const dy = e.clientY - session.startY
    const nextW = Math.max(MIN_W, session.startW + dx)
    const nextH = Math.max(MIN_H, session.startH + dy)
    pendingSizeRef.current = { w: nextW, h: nextH }
    const el = rootRef.current
    if (el) {
      el.style.width = `${nextW}px`
      el.style.height = `${nextH}px`
    }
  }

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    finishResize(e.pointerId)
  }

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const bumpFont = (delta: number) => {
    onActivate(note.id)
    onFontSizeChange(note.id, fs + delta)
  }

  const toggleBold = () => {
    onActivate(note.id)
    onFontWeightChange(note.id, isBold ? 'normal' : 'bold')
  }

  const rootClass = [
    'memo-sticky-note__root',
    isActive ? 'memo-sticky-note__root--active' : '',
    isDragging ? 'memo-sticky-note__root--dragging' : '',
    isMinimized ? 'memo-sticky-note__root--minimized' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={rootRef}
      className={rootClass}
      onClick={(e) => {
        if (e.target !== e.currentTarget) {
          return
        }
        onRootClick(note.id)
      }}
      style={{
        position: 'absolute',
        left: note.x,
        top: note.y,
        width: w,
        height: displayH,
        zIndex: Number(note.zIndex) || 0,
        touchAction: 'none',
      }}
    >
      <header
        className="memo-sticky-note__titlebar"
        onPointerDown={handleTitlebarPointerDown}
        onPointerMove={handleTitlebarPointerMove}
        onPointerUp={handleTitlebarPointerUp}
        onPointerCancel={handleTitlebarPointerUp}
      >
        <span className="memo-sticky-note__title-preview">{preview}</span>
        <div className="memo-sticky-note__titlebar-actions">
          <button
            type="button"
            className="memo-sticky-note__titlebar-btn"
            data-no-drag="true"
            aria-label={isMinimized ? '메모 복원' : '메모 최소화'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onToggleMinimize(note.id)
            }}
          >
            {isMinimized ? '□' : '−'}
          </button>
          <button
            type="button"
            className="memo-sticky-note__titlebar-btn memo-sticky-note__titlebar-btn--danger"
            data-no-drag="true"
            aria-label="메모 삭제"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onDeleteRequest(note.id)
            }}
          >
            ×
          </button>
        </div>
      </header>

      {!isMinimized ? (
        <>
          <div className="memo-sticky-note__content">
            <FormTextarea
              className={`memo-sticky-note__textarea touch-manipulation ${
                isEditing ? 'memo-sticky-note__textarea--editing' : ''
              } ${isBold ? 'memo-sticky-note__textarea--bold' : ''}`}
              style={
                {
                  '--memo-font-size': `${fs}px`,
                  '--memo-font-weight': isBold ? '700' : '400',
                } as CSSProperties
              }
              value={note.content}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => onTextareaFocus(note.id)}
              onBlur={() => onTextareaBlur()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              placeholder="메모를 입력하세요"
              aria-label="메모 내용"
              inputMode="text"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
            />
          </div>
          <footer className="memo-sticky-note__footer">
            <button
              type="button"
              className={`memo-sticky-note__tool-button${isBold ? ' memo-sticky-note__tool-button--active' : ''}`}
              data-no-drag="true"
              aria-label="굵게"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                toggleBold()
              }}
            >
              B
            </button>
            <button
              type="button"
              className="memo-sticky-note__tool-button"
              data-no-drag="true"
              aria-label="글자 크기 줄이기"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                bumpFont(-1)
              }}
            >
              A−
            </button>
            <button
              type="button"
              className="memo-sticky-note__tool-button"
              data-no-drag="true"
              aria-label="글자 크기 키우기"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                bumpFont(1)
              }}
            >
              A+
            </button>
          </footer>
          <div
            role="presentation"
            className="memo-sticky-note__resize"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
          >
            <span className="memo-sticky-note__resize-mark" aria-hidden />
          </div>
        </>
      ) : null}
    </div>
  )
}
