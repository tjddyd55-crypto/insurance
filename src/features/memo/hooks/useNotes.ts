import { useCallback, useEffect, useState } from 'react'
import type { Note } from '../types/memo.types'

const STORAGE_KEY = 'memo_notes'

/**
 * 초기 `notes`가 `[]`인 상태에서 곧바로 저장하면 기존 localStorage 를 덮어쓸 수 있어,
 * 초기값은 lazy initializer 로 복원한다. (요구된 load 로직과 동등)
 */
function readStoredNotes(): Note[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return []
    }
    const parsed = JSON.parse(saved) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    const result: Note[] = []
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) {
        continue
      }
      const o = item as Record<string, unknown>
      if (
        typeof o.id !== 'string' ||
        typeof o.content !== 'string' ||
        typeof o.x !== 'number' ||
        typeof o.y !== 'number'
      ) {
        continue
      }
      result.push({
        id: o.id,
        content: o.content,
        x: o.x,
        y: o.y,
      })
    }
    return result
  } catch {
    return []
  }
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(readStoredNotes)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    } catch {
      // 저장 공간 부족 등 — 무시
    }
  }, [notes])

  const addNote = useCallback(() => {
    setNotes((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        content: '',
        x: 100,
        y: 100,
      },
    ])
  }, [])

  const updateNote = useCallback((id: string, content: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)))
  }, [])

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)))
  }, [])

  return { notes, addNote, updateNote, updatePosition }
}
