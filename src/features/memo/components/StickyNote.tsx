import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Note } from '../types/memo.types'

type Props = {
  note: Note
  onChange: (content: string) => void
  onPositionChange: (id: string, x: number, y: number) => void
  containerRef: RefObject<HTMLElement | null>
}

export default function StickyNote({ note, onChange, onPositionChange, containerRef }: Props) {
  const [dragging, setDragging] = useState(false)
  /** 드래그 시작 시점: (컨테이너 기준 마우스) - note 위치 */
  const offsetRef = useRef({ x: 0, y: 0 })

  const handleDragHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    offsetRef.current = { x: mouseX - note.x, y: mouseY - note.y }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) {
      return
    }
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }
      const x = e.clientX - rect.left - offsetRef.current.x
      const y = e.clientY - rect.top - offsetRef.current.y
      onPositionChange(note.id, x, y)
    }
    const onUp = () => {
      setDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, note.id, onPositionChange])

  return (
    <div
      className="bg-yellow-100 rounded shadow w-48 h-40 flex flex-col overflow-hidden"
      style={{
        position: 'absolute',
        left: note.x,
        top: note.y,
      }}
    >
      <button
        type="button"
        className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-amber-900/80 bg-amber-200/60 border-b border-amber-300/80 cursor-grab active:cursor-grabbing select-none text-left"
        aria-label="메모 위치 이동"
        onMouseDown={handleDragHandleMouseDown}
      >
        <span aria-hidden>⋮⋮</span>
        이동
      </button>
      <textarea
        className="w-full min-h-0 flex-1 bg-transparent border-0 border-t border-yellow-200/80 rounded-none p-2 text-sm text-[var(--text-primary)] resize-none outline-none focus:ring-1 focus:ring-inset focus:ring-amber-300/80"
        value={note.content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="메모를 입력하세요"
        aria-label="메모 내용"
      />
    </div>
  )
}
