import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { memoApi } from '../api/memo.api'
import type { Note } from '../types/memo.types'

const CONTENT_SAVE_MS = 400
const POSITION_SAVE_MS = 350

export function useNotes() {
  const { token } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const contentTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const positionTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const ct = contentTimersRef.current
    const pt = positionTimersRef.current
    return () => {
      Object.values(ct).forEach((t) => clearTimeout(t))
      Object.values(pt).forEach((t) => clearTimeout(t))
    }
  }, [])

  useEffect(() => {
    if (!token?.trim()) {
      setNotes([])
      return
    }
    let cancelled = false
    void memoApi
      .getAll(token)
      .then((rows) => {
        if (!cancelled) {
          setNotes(rows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotes([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const addNote = useCallback(async () => {
    const auth = token?.trim()
    if (!auth) {
      return
    }
    try {
      const newNote = await memoApi.create({ content: '', x: 100, y: 100 }, auth)
      setNotes((prev) => [...prev, newNote])
    } catch {
      // 실패 시 목록은 그대로
    }
  }, [token])

  const updateNote = useCallback(
    (id: string, content: string) => {
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)))
      const auth = token?.trim()
      if (!auth) {
        return
      }
      const prev = contentTimersRef.current[id]
      if (prev) {
        clearTimeout(prev)
      }
      contentTimersRef.current[id] = setTimeout(() => {
        delete contentTimersRef.current[id]
        void memoApi.update(id, { content }, auth).catch(() => {})
      }, CONTENT_SAVE_MS)
    },
    [token],
  )

  const updatePosition = useCallback(
    (id: string, x: number, y: number) => {
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)))
      const auth = token?.trim()
      if (!auth) {
        return
      }
      const prev = positionTimersRef.current[id]
      if (prev) {
        clearTimeout(prev)
      }
      positionTimersRef.current[id] = setTimeout(() => {
        delete positionTimersRef.current[id]
        void memoApi.update(id, { x, y }, auth).catch(() => {})
      }, POSITION_SAVE_MS)
    },
    [token],
  )

  const deleteNote = useCallback(
    async (id: string) => {
      const auth = token?.trim()
      if (!auth) {
        return
      }
      try {
        await memoApi.delete(id, auth)
        setNotes((prev) => prev.filter((n) => n.id !== id))
      } catch {
        // 유지
      }
    },
    [token],
  )

  return { notes, addNote, updateNote, updatePosition, deleteNote }
}
