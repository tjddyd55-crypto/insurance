import { useCallback, useState } from 'react'
import type { Note } from '../types/memo.types'

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])

  const addNote = useCallback(() => {
    setNotes((prev) => [...prev, { id: Date.now().toString(), content: '' }])
  }, [])

  const updateNote = useCallback((id: string, content: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)))
  }, [])

  return { notes, addNote, updateNote }
}
