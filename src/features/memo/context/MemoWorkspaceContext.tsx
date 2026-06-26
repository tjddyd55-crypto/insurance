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
import { buildArrangedNotePositions, clampNotePosition, getMemoBoardCanvasHeight, MEMO_ROUTED_BOARD_MIN_HEIGHT } from '@insurance-shared/memoLayout.js'

const ROUTED_MEMO_DRAG_EXTENSION = 160

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
  getWorkspaceBounds: () => { width: number; height: number }
  promoteNote: (id: string) => void
  handleRootClick: (id: string) => void
  handleActivate: (id: string) => void
  handleTextareaFocus: (id: string) => void
  handleTextareaBlur: () => void
  handleDragStart: (id: string) => void
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
  toggleMinimizeNote: (id: string) => void
  expandMinimizeNote: (id: string) => void
  minimizeNote: (id: string) => void
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

  const toggleMinimizeNote = useCallback((id: string) => {
    setMinimizedNotes((prev) => {
      const next = { ...prev }
      if (next[id]) {
        delete next[id]
      } else {
        next[id] = true
      }
      return next
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

  /** @deprecated hiddenNotes hide — use toggleMinimizeNote for sticker collapse */
  const minimizeNote = useCallback((id: string) => {
    toggleMinimizeNote(id)
  }, [toggleMinimizeNote])

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

  const getWorkspaceBounds = useCallback(() => {
    const boardEl = containerRef.current ?? workspaceRef.current
    if (!boardEl) {
      return { width: 0, height: 0 }
    }
    const viewportHeight = boardEl.clientHeight
    const scrollHeight = boardEl.scrollHeight
    const routedFloor = routedPage ? MEMO_ROUTED_BOARD_MIN_HEIGHT : 0
    return {
      width: boardEl.clientWidth,
      height: Math.max(
        viewportHeight,
        scrollHeight,
        routedFloor,
        viewportHeight + (routedPage ? ROUTED_MEMO_DRAG_EXTENSION : 0),
      ),
    }
  }, [routedPage])

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

  const canvasHeight = useMemo(() => {
    const boardNotes = routedPage ? notes : notes.filter((n) => !hiddenNotes[n.id])
    const viewportHeight = containerRef.current?.clientHeight ?? workspaceRef.current?.clientHeight ?? 720
    const minimizedNoteIds = Object.keys(minimizedNotes).filter((id) => minimizedNotes[id])
    return getMemoBoardCanvasHeight(boardNotes, { routedPage, viewportHeight, minimizedNoteIds })
  }, [notes, hiddenNotes, minimizedNotes, routedPage, workspaceSizeTick])

  useEffect(() => {
    if (notes.length === 0 || draggingNoteId != null) {
      return
    }
    const measureAndClamp = () => {
      const boardEl = containerRef.current ?? workspaceRef.current
      const measuredWidth = boardEl?.clientWidth ?? 0
      const measuredHeight = boardEl?.clientHeight ?? 0
      const workspaceWidth = measuredWidth > 0 ? measuredWidth : 960
      const workspaceHeight =
        measuredHeight > 0
          ? Math.max(measuredHeight, boardEl?.scrollHeight ?? 0, routedPage ? MEMO_ROUTED_BOARD_MIN_HEIGHT : 0)
          : routedPage
            ? MEMO_ROUTED_BOARD_MIN_HEIGHT
            : 480

      notes.forEach((note) => {
        const { x: fixedX, y: fixedY } = clampNotePosition(note, workspaceWidth, workspaceHeight)
        if (fixedX !== note.x || fixedY !== note.y) {
          updatePosition(note.id, fixedX, fixedY)
        }
      })
    }

    measureAndClamp()
    if (routedPage) {
      requestAnimationFrame(measureAndClamp)
      requestAnimationFrame(() => requestAnimationFrame(measureAndClamp))
    }
  }, [draggingNoteId, notes, routedPage, updatePosition, workspaceSizeTick])

  const ensureRoutedNoteVisible = useCallback(
    (id: string, options: { center?: boolean } = {}) => {
      if (!routedPage) {
        return false
      }
      const note = notes.find((n) => n.id === id)
      const workspace = workspaceRef.current
      if (!note || !workspace) {
        return false
      }

      const viewportWidth = workspace.clientWidth
      const viewportHeight = workspace.clientHeight
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
        workspace.scrollTo({
          left: Math.max(0, nextX - pad),
          top: Math.max(0, nextY - pad),
          behavior: 'smooth',
        })
      })
      return true
    },
    [notes, routedPage, updatePosition],
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
    },
    [promoteNote],
  )

  const handleDragEnd = useCallback(() => {
    setDraggingNoteId(null)
  }, [])

  const handleRequestDelete = useCallback((id: string) => {
    setPendingDeleteId(id)
  }, [])

  const scrollCanvasToNote = useCallback(
    (id: string) => {
      const note = notes.find((n) => n.id === id)
      const y = note ? note.y : 0
      requestAnimationFrame(() => {
        workspaceRef.current?.scrollTo({
          top: Math.max(0, y - 40),
          behavior: 'smooth',
        })
      })
    },
    [notes],
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
        const workspace = workspaceRef.current
        const { width } = getWorkspaceBounds()
        const noteWidth = Math.max(200, Number(created.width) || 200)
        const x = Math.max(20, Math.min(100, Math.max(20, width - noteWidth - 20)))
        const y = Math.max(20, (workspace?.scrollTop ?? 0) + 20)
        updatePosition(created.id, x, y)
        scrollCanvasToNote(created.id)
      })
    }
  }, [
    addNote,
    bringToFront,
    getWorkspaceBounds,
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
    const minimizedNoteIds = Object.keys(minimizedNotes).filter((id) => minimizedNotes[id])
    const positions = buildArrangedNotePositions(notes, { boardWidth, minimizedNoteIds })
    setHiddenNotes({})
    positions.forEach((target) => {
      updatePosition(target.id, target.x, target.y)
    })
  }, [minimizedNotes, notes, updatePosition])

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
      getWorkspaceBounds,
      promoteNote,
      handleRootClick,
      handleActivate,
      handleTextareaFocus,
      handleTextareaBlur,
      handleDragStart,
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
      toggleMinimizeNote,
      expandMinimizeNote,
      minimizeNote,
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
      getWorkspaceBounds,
      promoteNote,
      handleRootClick,
      handleActivate,
      handleTextareaFocus,
      handleTextareaBlur,
      handleDragStart,
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
      toggleMinimizeNote,
      expandMinimizeNote,
      minimizeNote,
      restoreNote,
      routedPage,
      addAndSelectNote,
    ],
  )

  return <MemoWorkspaceContext.Provider value={value}>{children}</MemoWorkspaceContext.Provider>
}
