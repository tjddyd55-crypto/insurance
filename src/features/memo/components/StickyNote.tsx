import { FormTextarea } from '../../../components/form'
import { useCallback, useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import type { Note } from '../types/memo.types'
import {
  MEMO_DEFAULT_HEIGHT,
  MEMO_DEFAULT_WIDTH,
  MEMO_MIN_HEIGHT,
  MEMO_MIN_WIDTH,
} from '@insurance-shared/memoLayout.js'

const MIN_W = MEMO_MIN_WIDTH
const MIN_H = MEMO_MIN_HEIGHT
const FONT_MIN = 12
const FONT_MAX = 24

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

type Props = {
  note: Note
  isActive: boolean
  isEditing: boolean
  isDragging: boolean
  onChange: (content: string) => void
  onPositionCommit: (id: string, x: number, y: number) => void
  onSizeCommit: (id: string, width: number, height: number) => void
  onFontSizeChange: (id: string, fontSize: number) => void
  containerRef: RefObject<HTMLElement | null>
  getWorkspaceBounds: () => { width: number; height: number }
  onDeleteRequest: (id: string) => void
  onRootClick: (id: string) => void
  onActivate: (id: string) => void
  onTextareaFocus: (id: string) => void
  onTextareaBlur: () => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onMinimize?: (id: string) => void
}

export default function StickyNote({
  note,
  isActive,
  isEditing,
  isDragging,
  onChange,
  onPositionCommit,
  onSizeCommit,
  onFontSizeChange,
  containerRef,
  getWorkspaceBounds,
  onDeleteRequest,
  onRootClick,
  onActivate,
  onTextareaFocus,
  onTextareaBlur,
  onDragStart,
  onDragEnd,
  onMinimize,
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
  const h = Math.max(MIN_H, Number(note.height) || MEMO_DEFAULT_HEIGHT)
  const fs = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(Number(note.fontSize) || 16)))

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

  const handleDragPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (resizeSessionRef.current) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    onDragStart(note.id)

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    const noteW = Math.max(MIN_W, Number(note.width) || MEMO_DEFAULT_WIDTH)
    const noteH = Math.max(MIN_H, Number(note.height) || MEMO_DEFAULT_HEIGHT)
    dragSessionRef.current = {
      pointerId: e.pointerId,
      originX: note.x,
      originY: note.y,
      offsetX: e.clientX - rect.left - note.x,
      offsetY: e.clientY - rect.top - note.y,
      bounds: getWorkspaceBounds(),
      noteW,
      noteH,
    }
    pendingPosRef.current = { x: note.x, y: note.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleDragPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
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

  const handleDragPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
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
    if (dragSessionRef.current) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    onActivate(note.id)
    const startW = Math.max(MIN_W, Number(note.width) || MEMO_DEFAULT_WIDTH)
    const startH = Math.max(MIN_H, Number(note.height) || MEMO_DEFAULT_HEIGHT)
    resizeSessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW,
      startH,
    }
    pendingSizeRef.current = { w: startW, h: startH }
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

  const rootClass = [
    'memo-sticky-note__root',
    isActive ? 'memo-sticky-note__root--active' : '',
    isDragging ? 'memo-sticky-note__root--dragging' : '',
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
        height: h,
        zIndex: Number(note.zIndex) || 0,
        touchAction: 'none',
      }}
    >
      <div className="memo-sticky-note__header">
        <button
          type="button"
          className="memo-sticky-note__handle"
          aria-label="메모 이동"
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          onPointerCancel={handleDragPointerUp}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="memo-sticky-note__handle-grip" aria-hidden />
        </button>
        <div className="memo-sticky-note__toolbar">
          <button
            type="button"
            className="memo-sticky-note__icon-btn"
            aria-label="글자 크기 줄이기"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              bumpFont(-1)
            }}
          >
            −
          </button>
          <button
            type="button"
            className="memo-sticky-note__icon-btn"
            aria-label="글자 크기 키우기"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              bumpFont(1)
            }}
          >
            +
          </button>
          {onMinimize ? (
            <button
              type="button"
              className="memo-sticky-note__icon-btn"
              aria-label="메모 숨기기"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onMinimize(note.id)
              }}
            >
              −
            </button>
          ) : null}
          <button
            type="button"
            className="memo-sticky-note__icon-btn memo-sticky-note__icon-btn--danger"
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
      </div>
      <div className="memo-sticky-note__content">
        <FormTextarea
          className={`memo-sticky-note__textarea touch-manipulation ${
            isEditing ? 'memo-sticky-note__textarea--editing' : ''
          }`}
          style={
            {
              '--memo-font-size': `${fs}px`,
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
    </div>
  )
}
