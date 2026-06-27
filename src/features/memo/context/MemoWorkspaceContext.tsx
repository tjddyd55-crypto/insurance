/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useNotes } from '../hooks/useNotes'
import { loadMemoUiSnapshot, patchMemoUiCanvas } from '../memoUiStorage'
import { buildArrangedNotePositions, clampNotePosition, clampNotePositionMin, getMemoBoardCanvasSize, getMemoBoardVisibleNotes, MEMO_DEFAULT_HEIGHT, MEMO_DEFAULT_WIDTH, MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH, MEMO_ROUTED_BOARD_MIN_HEIGHT } from '@insurance-shared/memoLayout.js'

type MemoDragDraft = {
  noteId: string
  x: number
  y: number
  width: number
  height: number
}

type MemoWorkspaceContextValue = ReturnType<typeof useNotes> & {
  token: string | undefined
  workspaceRef: React.RefObject<HTMLDivElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  activeNoteId: string | null
  editingNoteId: string | null
  draggingNoteId: string | null
  pendingDeleteId: string | null
  deleteSubmitting: boolean
  canvasHeight: number | undefined
  canvasWidth: number | undefined
  getWorkspaceBounds: () => { width: number; height: number }
  promoteNote: (id: string) => void
  handleRootClick: (id: string) => void
  handleActivate: (id: string) => void
  handleTextareaFocus: (id: string) => void
  handleTextareaBlur: () => void
  handleDragStart: (id: string) => void
  handleDragMove: (id: string, x: number, y: number) => void
  handleDragEnd: () => void
  handleRequestDelete: (id: string) => void
  handleSidebarSelectNote: (id: string) => void
  handleCanvasClick: (e: ReactMouseEvent<HTMLDivElement>) => void
  handleAutoArrange: () => void
  closeDeleteModal: () => void
  confirmDelete: () => Promise<void>
  isMinimized: boolean
  setIsMinimized: Dispatch<SetStateAction<boolean>>
  /** 캔버스에서 숨김(프론트 전용, DB 미사용) — 리스트에서 복구 */
  hiddenNotes: Record<string, boolean>
  /** 스티커 접힘(최소화) — 본문/하단바 접기, localStorage 저장 */
  minimizedNotes: Record<string, boolean>
  minimizeNote: (id: string) => void
  expandMinimizeNote: (id: string) => void
  restoreNote: (id: string) => void
  /** `/memo` 정식 페이지 — 캔버스 대신 목록+상세 패널 레이아웃 */
  routedPage: boolean
  addAndSelectNote: () => Promise<void>
}

const MemoWorkspaceContext = createContext<MemoWorkspaceContextValue | null>(null)

export function useMemoWorkspace() {
  const v = useContext(MemoWorkspaceContext)
  if (!v) {
    throw new Error('useMemoWorkspace must be used within MemoWorkspaceProvider')
  }
  return v
}

type MemoWorkspaceProviderProps = {
  children: ReactNode
  /** `/memo` 라우트 — 정식 페이지 컨텍스트(숨김 복원·목록 연동) */
  routedPage?: boolean
}

export function MemoWorkspaceProvider({ children, routedPage = false }: MemoWorkspaceProviderProps) {
  const { token, user } = useAuth()
  const persistenceUserId = String(user?.id ?? '')
  const notesApi = useNotes()
  const { notes, updatePosition, deleteNote, bringToFront, addNote } = notesApi

  const workspaceRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const activeNoteIdRef = useRef<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null)
  const [dragDraft, setDragDraft] = useState<MemoDragDraft | null>(null)

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [hiddenNotes, setHiddenNotes] = useState<Record<string, boolean>>({})
  const [minimizedNotes, setMinimizedNotes] = useState<Record<string, boolean>>({})
  const [workspaceSizeTick, setWorkspaceSizeTick] = useState(0)
  const canvasHydratedRef = useRef(false)
  const skipCanvasPersistRef = useRef(true)

  useEffect(() => {
    skipCanvasPersistRef.current = true
  }, [persistenceUserId])

  useEffect(() => {
    if (!persistenceUserId) {
      canvasHydratedRef.current = false
      return
    }
    if (routedPage) {
      setHiddenNotes({})
      setIsMinimized(false)
      const snap = loadMemoUiSnapshot(persistenceUserId)
      const nextMinimized: Record<string, boolean> = {}
      if (snap?.canvas?.minimizedNoteIds) {
        for (const id of snap.canvas.minimizedNoteIds) {
          nextMinimized[id] = true
        }
      }
      setMinimizedNotes(nextMinimized)
      canvasHydratedRef.current = true
      skipCanvasPersistRef.current = true
      return
    }
    const snap = loadMemoUiSnapshot(persistenceUserId)
    if (snap?.canvas) {
      setIsMinimized(snap.canvas.isMinimized)
      const nextHidden: Record<string, boolean> = {}
      for (const id of snap.canvas.hiddenNoteIds) {
        nextHidden[id] = true
      }
      setHiddenNotes(nextHidden)
      const nextMinimized: Record<string, boolean> = {}
      for (const id of snap.canvas.minimizedNoteIds) {
        nextMinimized[id] = true
      }
      setMinimizedNotes(nextMinimized)
    }
    canvasHydratedRef.current = true
  }, [persistenceUserId, routedPage])

  useEffect(() => {
    if (!persistenceUserId || !canvasHydratedRef.current) {
      return
    }
    if (skipCanvasPersistRef.current) {
      skipCanvasPersistRef.current = false
      return
    }
    if (routedPage) {
      patchMemoUiCanvas(persistenceUserId, {
        minimizedNoteIds: Object.keys(minimizedNotes).filter((id) => minimizedNotes[id]),
      })
      return
    }
    patchMemoUiCanvas(persistenceUserId, {
      isMinimized,
      hiddenNoteIds: Object.keys(hiddenNotes).filter((id) => hiddenNotes[id]),
      minimizedNoteIds: Object.keys(minimizedNotes).filter((id) => minimizedNotes[id]),
    })
  }, [persistenceUserId, isMinimized, hiddenNotes, minimizedNotes, routedPage])

  const minimizeNote = useCallback((id: string) => {
    setMinimizedNotes((prev) => {
      if (prev[id]) {
        return prev
      }
      return { ...prev, [id]: true }
    })
  }, [])

  const expandMinimizeNote = useCallback((id: string) => {
    setMinimizedNotes((prev) => {
      if (!(id in prev)) {
        return prev
      }
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const restoreNote = useCallback((id: string) => {
    setHiddenNotes((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  useEffect(() => {
    activeNoteIdRef.current = activeNoteId
  }, [activeNoteId])

  const boardNotesForLayout = useMemo(() => {
    const visible = getMemoBoardVisibleNotes(notes, hiddenNotes, routedPage, minimizedNotes)
    if (!dragDraft) {
      return visible
    }
    return visible.map((note) =>
      note.id === dragDraft.noteId ? { ...note, x: dragDraft.x, y: dragDraft.y } : note,
    )
  }, [dragDraft, hiddenNotes, minimizedNotes, notes, routedPage])

  const canvasSize = useMemo(() => {
    const scrollEl = workspaceRef.current?.parentElement
    const viewportWidth = scrollEl?.clientWidth ?? workspaceRef.current?.clientWidth ?? 960
    const viewportHeight = scrollEl?.clientHeight ?? workspaceRef.current?.clientHeight ?? 720
    return getMemoBoardCanvasSize(boardNotesForLayout, {
      routedPage,
      viewportWidth,
      viewportHeight,
    })
  }, [boardNotesForLayout, routedPage, workspaceSizeTick])

  const canvasWidth = canvasSize.width
  const canvasHeight = canvasSize.height

  const getWorkspaceBounds = useCallback(() => {
    const boardEl = containerRef.current ?? workspaceRef.current
    const viewportHeight = boardEl?.clientHeight ?? 0
    const routedFloor = routedPage ? MEMO_ROUTED_BOARD_MIN_HEIGHT : 0
    return {
      width: canvasWidth,
      height: Math.max(canvasHeight ?? viewportHeight, viewportHeight, routedFloor),
    }
  }, [canvasHeight, canvasWidth, routedPage])

  useEffect(() => {
    const el = containerRef.current ?? workspaceRef.current
    if (!el || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(() => {
      setWorkspaceSizeTick((tick) => tick + 1)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (notes.length === 0 || draggingNoteId != null) {
      return
    }
    const measureAndClamp = () => {
      const scrollEl = workspaceRef.current?.parentElement
      const measuredWidth = scrollEl?.clientWidth ?? workspaceRef.current?.clientWidth ?? 960
      const measuredHeight = scrollEl?.clientHeight ?? workspaceRef.current?.clientHeight ?? 480

      notes.forEach((note) => {
        const next = routedPage
          ? clampNotePositionMin(note)
          : clampNotePosition(note, measuredWidth, measuredHeight)
        if (next.x !== note.x || next.y !== note.y) {
          updatePosition(note.id, next.x, next.y)
        }
      })
    }

    measureAndClamp()
    if (routedPage) {
      requestAnimationFrame(measureAndClamp)
      requestAnimationFrame(() => requestAnimationFrame(measureAndClamp))
    }
  }, [draggingNoteId, notes, routedPage, updatePosition, workspaceSizeTick])

  const getMemoScrollContainer = useCallback(() => {
    return workspaceRef.current?.parentElement ?? workspaceRef.current
  }, [])

  const ensureRoutedNoteVisible = useCallback(
    (id: string, options: { center?: boolean } = {}) => {
      if (!routedPage) {
        return false
      }
      const note = notes.find((n) => n.id === id)
      const scrollContainer = getMemoScrollContainer()
      if (!note || !scrollContainer) {
        return false
      }

      const viewportWidth = scrollContainer.clientWidth
      const viewportHeight = scrollContainer.clientHeight
      if (viewportWidth <= 0 || viewportHeight <= 0) {
        return false
      }

      const pad = 20
      const noteWidth = Math.max(200, Number(note.width) || 200)
      const noteHeight = Math.max(150, Number(note.height) || 160)
      const maxX = Math.max(pad, viewportWidth - noteWidth - pad)
      const maxY = Math.max(pad, viewportHeight - noteHeight - pad)
      const centeredX = Math.max(pad, Math.round((viewportWidth - noteWidth) / 2))
      const centeredY = Math.max(pad, Math.round((viewportHeight - noteHeight) / 2))
      const nextX = options.center ? centeredX : Math.max(pad, Math.min(note.x, maxX))
      const nextY = options.center ? centeredY : Math.max(pad, Math.min(note.y, maxY))

      if (nextX !== note.x || nextY !== note.y) {
        updatePosition(note.id, nextX, nextY)
      }

      requestAnimationFrame(() => {
        scrollContainer.scrollTo({
          left: Math.max(0, nextX - pad),
          top: Math.max(0, nextY - pad),
          behavior: 'smooth',
        })
      })
      return true
    },
    [getMemoScrollContainer, notes, routedPage, updatePosition],
  )

  const promoteNote = useCallback(
    (id: string) => {
      if (activeNoteIdRef.current === id) {
        setActiveNoteId(id)
        return
      }

      bringToFront(id)
      activeNoteIdRef.current = id
      setActiveNoteId(id)
    },
    [bringToFront],
  )

  const handleRootClick = useCallback(
    (id: string) => {
      promoteNote(id)
    },
    [promoteNote],
  )

  const handleActivate = useCallback((id: string) => {
    activeNoteIdRef.current = id
    setActiveNoteId(id)
  }, [])

  const handleTextareaFocus = useCallback(
    (id: string) => {
      promoteNote(id)
      setEditingNoteId(id)
    },
    [promoteNote],
  )

  const handleTextareaBlur = useCallback(() => {
    setEditingNoteId(null)
  }, [])

  const handleDragStart = useCallback(
    (id: string) => {
      setEditingNoteId(null)
      promoteNote(id)
      setDraggingNoteId(id)
      const note = notes.find((item) => item.id === id)
      if (!note) {
        setDragDraft(null)
        return
      }
      setDragDraft({
        noteId: id,
        x: note.x,
        y: note.y,
        width: Math.max(MEMO_MIN_WIDTH, Number(note.width) || MEMO_DEFAULT_WIDTH),
        height: Math.max(MEMO_MIN_HEIGHT, Number(note.height) || MEMO_DEFAULT_HEIGHT),
      })
    },
    [notes, promoteNote],
  )

  const handleDragMove = useCallback(
    (id: string, x: number, y: number) => {
      const note = notes.find((item) => item.id === id)
      if (!note) {
        return
      }
      setDragDraft({
        noteId: id,
        x,
        y,
        width: Math.max(MEMO_MIN_WIDTH, Number(note.width) || MEMO_DEFAULT_WIDTH),
        height: Math.max(MEMO_MIN_HEIGHT, Number(note.height) || MEMO_DEFAULT_HEIGHT),
      })
    },
    [notes],
  )

  const handleDragEnd = useCallback(() => {
    setDraggingNoteId(null)
    setDragDraft(null)
  }, [])

  const handleRequestDelete = useCallback((id: string) => {
    setPendingDeleteId(id)
  }, [])

  const scrollCanvasToNote = useCallback(
    (id: string) => {
      const note = notes.find((n) => n.id === id)
      const scrollContainer = getMemoScrollContainer()
      const y = note ? note.y : 0
      requestAnimationFrame(() => {
        scrollContainer?.scrollTo({
          top: Math.max(0, y - 40),
          behavior: 'smooth',
        })
      })
    },
    [getMemoScrollContainer, notes],
  )

  const handleSidebarSelectNote = useCallback(
    (id: string) => {
      setIsMinimized(false)
      restoreNote(id)
      expandMinimizeNote(id)
      // 리스트에서 선택해도 캔버스 클릭과 동일하게 최상단으로 승격한다.
      bringToFront(id)
      activeNoteIdRef.current = id
      setActiveNoteId(id)
      if (routedPage) {
        setEditingNoteId(id)
      }
      if (!ensureRoutedNoteVisible(id)) {
        scrollCanvasToNote(id)
      }
    },
    [
      bringToFront,
      ensureRoutedNoteVisible,
      expandMinimizeNote,
      restoreNote,
      routedPage,
      scrollCanvasToNote,
      setIsMinimized,
    ],
  )

  const addAndSelectNote = useCallback(async () => {
    const created = await addNote()
    if (!created) {
      return
    }
    restoreNote(created.id)
    bringToFront(created.id)
    activeNoteIdRef.current = created.id
    setActiveNoteId(created.id)
    setEditingNoteId(created.id)

    if (routedPage) {
      requestAnimationFrame(() => {
        const scrollContainer = getMemoScrollContainer()
        const viewportWidth = scrollContainer?.clientWidth ?? 960
        const noteWidth = Math.max(200, Number(created.width) || 200)
        const x = Math.max(20, Math.min(100, Math.max(20, viewportWidth - noteWidth - 20)))
        const y = Math.max(20, (scrollContainer?.scrollTop ?? 0) + 20)
        updatePosition(created.id, x, y)
        scrollCanvasToNote(created.id)
      })
    }
  }, [
    addNote,
    bringToFront,
    getMemoScrollContainer,
    restoreNote,
    routedPage,
    scrollCanvasToNote,
    updatePosition,
  ])

  /** 라우트 페이지: 선택 메모 보정 — 숨김 없이 전체 보드에 표시 */
  useEffect(() => {
    if (!routedPage || notes.length === 0) {
      return
    }
    if (activeNoteId && notes.some((n) => n.id === activeNoteId)) {
      ensureRoutedNoteVisible(activeNoteId)
      return
    }
    const sorted = [...notes].sort(
      (a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0),
    )
    const top = sorted[0]
    if (!top) {
      return
    }
    restoreNote(top.id)
    bringToFront(top.id)
    activeNoteIdRef.current = top.id
    setActiveNoteId(top.id)
    ensureRoutedNoteVisible(top.id)
  }, [
    activeNoteId,
    bringToFront,
    ensureRoutedNoteVisible,
    notes,
    restoreNote,
    routedPage,
    workspaceSizeTick,
  ])

  const handleCanvasClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      activeNoteIdRef.current = null
      setActiveNoteId(null)
    }
  }, [])

  const handleAutoArrange = useCallback(() => {
    const boardEl = containerRef.current ?? workspaceRef.current
    const boardWidth = boardEl?.clientWidth ?? 1200
    const visibleNotes = getMemoBoardVisibleNotes(notes, hiddenNotes, routedPage, minimizedNotes)
    const positions = buildArrangedNotePositions(visibleNotes, { boardWidth })
    setHiddenNotes({})
    positions.forEach((target) => {
      updatePosition(target.id, target.x, target.y)
    })
  }, [hiddenNotes, minimizedNotes, notes, routedPage, updatePosition])

  const closeDeleteModal = useCallback(() => {
    if (deleteSubmitting) {
      return
    }
    setPendingDeleteId(null)
  }, [deleteSubmitting])

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId || deleteSubmitting) {
      return
    }
    setDeleteSubmitting(true)
    try {
      const id = pendingDeleteId
      await deleteNote(id)
      setHiddenNotes((prev) => {
        if (!(id in prev)) {
          return prev
        }
        const next = { ...prev }
        delete next[id]
        return next
      })
      setMinimizedNotes((prev) => {
        if (!(id in prev)) {
          return prev
        }
        const next = { ...prev }
        delete next[id]
        return next
      })
      setActiveNoteId((prev) => {
        const next = prev === id ? null : prev
        activeNoteIdRef.current = next
        return next
      })
      setEditingNoteId((prev) => (prev === id ? null : prev))
      setDraggingNoteId((prev) => (prev === id ? null : prev))
      setDragDraft((prev) => (prev?.noteId === id ? null : prev))
      setPendingDeleteId(null)
    } finally {
      setDeleteSubmitting(false)
    }
  }, [pendingDeleteId, deleteSubmitting, deleteNote])

  const value = useMemo<MemoWorkspaceContextValue>(
    () => ({
      ...notesApi,
      token: token?.trim(),
      workspaceRef,
      containerRef,
      activeNoteId,
      editingNoteId,
      draggingNoteId,
      pendingDeleteId,
      deleteSubmitting,
      canvasHeight,
      canvasWidth,
      getWorkspaceBounds,
      promoteNote,
      handleRootClick,
      handleActivate,
      handleTextareaFocus,
      handleTextareaBlur,
      handleDragStart,
      handleDragMove,
      handleDragEnd,
      handleRequestDelete,
      handleSidebarSelectNote,
      handleCanvasClick,
      handleAutoArrange,
      closeDeleteModal,
      confirmDelete,
      isMinimized,
      setIsMinimized,
      hiddenNotes,
      minimizedNotes,
      minimizeNote,
      expandMinimizeNote,
      restoreNote,
      routedPage,
      addAndSelectNote,
    }),
    [
      notesApi,
      token,
      activeNoteId,
      editingNoteId,
      draggingNoteId,
      pendingDeleteId,
      deleteSubmitting,
      canvasHeight,
      canvasWidth,
      getWorkspaceBounds,
      promoteNote,
      handleRootClick,
      handleActivate,
      handleTextareaFocus,
      handleTextareaBlur,
      handleDragStart,
      handleDragMove,
      handleDragEnd,
      handleRequestDelete,
      handleSidebarSelectNote,
      handleCanvasClick,
      handleAutoArrange,
      closeDeleteModal,
      confirmDelete,
      isMinimized,
      hiddenNotes,
      minimizedNotes,
      minimizeNote,
      expandMinimizeNote,
      restoreNote,
      routedPage,
      addAndSelectNote,
    ],
  )

  return <MemoWorkspaceContext.Provider value={value}>{children}</MemoWorkspaceContext.Provider>
}
