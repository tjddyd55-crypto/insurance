import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  FB_NAV_ITEMS,
  FB_SECTION_IDS,
  type FacebookIntroSectionId,
} from '../config/facebookIntroductionLandingContent'
import { trackFacebookLandingEvent } from '../utils/facebookLandingAnalytics'
import { scrollToIntroSection } from './useIntroductionLandingState'

const HEADER_SCROLL_THRESHOLD = 8
const OBSERVER_ROOT_MARGIN = '-96px 0px -55% 0px'

export function useFacebookIntroductionLandingState() {
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState<FacebookIntroSectionId>('fb-hero')
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

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
    if (!raw) return
    if (!(FB_SECTION_IDS as readonly string[]).includes(raw)) return
    const id = window.setTimeout(() => scrollToIntroSection(raw), 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    const sections = FB_SECTION_IDS.map((id) => document.getElementById(id)).filter(
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
        if ((FB_SECTION_IDS as readonly string[]).includes(top.target.id)) {
          setActiveSection(top.target.id as FacebookIntroSectionId)
        }
      },
      { rootMargin: OBSERVER_ROOT_MARGIN, threshold: [0, 0.15, 0.35, 0.55] },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    trackFacebookLandingViewOnce()
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
    navItems: FB_NAV_ITEMS,
    toggleMenu,
    openMenu,
    closeMenu,
    goToSection,
  }
}

let facebookLandingViewTracked = false

function trackFacebookLandingViewOnce() {
  if (facebookLandingViewTracked) return
  facebookLandingViewTracked = true
  trackFacebookLandingEvent('facebook_landing_view')
}

export type FacebookIntroductionLandingState = ReturnType<typeof useFacebookIntroductionLandingState>
