import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { INTRO_NAV_ITEMS, INTRO_SECTION_IDS, type IntroSectionId } from '../config/introductionLandingContent'

const HEADER_SCROLL_THRESHOLD = 8
const OBSERVER_ROOT_MARGIN = '-96px 0px -55% 0px'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function scrollToIntroSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  })
}

export function useIntroductionLandingState() {
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState<IntroSectionId>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const menuPanelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > HEADER_SCROLL_THRESHOLD)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // /introduction#download 및 /introduction/install → #download 진입 시 섹션으로 이동
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
    if (!raw) return
    if (!(INTRO_SECTION_IDS as readonly string[]).includes(raw)) return
    const id = window.setTimeout(() => scrollToIntroSection(raw), 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    const sections = INTRO_SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (n): n is HTMLElement => Boolean(n),
    )
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (!top?.target?.id) return
        if ((INTRO_SECTION_IDS as readonly string[]).includes(top.target.id)) {
          setActiveSection(top.target.id as IntroSectionId)
        }
      },
      { rootMargin: OBSERVER_ROOT_MARGIN, threshold: [0, 0.15, 0.35, 0.55] },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    queueMicrotask(() => menuTriggerRef.current?.focus())
  }, [])

  const openMenu = useCallback(() => setMenuOpen(true), [])

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => {
      if (prev) queueMicrotask(() => menuTriggerRef.current?.focus())
      return !prev
    })
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu()
      }
    }
    window.addEventListener('keydown', onKey)
    const panel = menuPanelRef.current
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    focusables?.[0]?.focus()
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, closeMenu])

  const goToSection = useCallback(
    (id: string) => {
      scrollToIntroSection(id)
      if (menuOpen) closeMenu()
    },
    [menuOpen, closeMenu],
  )

  return {
    scrolled,
    activeSection,
    menuOpen,
    menuId,
    menuTriggerRef,
    menuPanelRef,
    navItems: INTRO_NAV_ITEMS,
    openMenu,
    closeMenu,
    toggleMenu,
    goToSection,
  }
}

export type IntroductionLandingState = ReturnType<typeof useIntroductionLandingState>
