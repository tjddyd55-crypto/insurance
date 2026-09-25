import { useEffect, useState } from 'react'
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist'

import { getPdfJsCmapAndStandardFontUrls } from '../../../lib/pdfjs/pdfDocumentInitParams'
import { setupPdfWorker } from '../../../lib/pdfjs/setupWorker'

setupPdfWorker()

type State =
  | { status: 'idle'; document: null; error: null }
  | { status: 'loading'; document: null; error: null }
  | { status: 'ready'; document: PDFDocumentProxy; error: null }
  | { status: 'error'; document: null; error: string }

export function useBinderPdfDocument(url: string | null): State {
  const [state, setState] = useState<State>({
    status: 'idle',
    document: null,
    error: null,
  })

  useEffect(() => {
    if (!url) {
      const frame = requestAnimationFrame(() => {
        setState({ status: 'idle', document: null, error: null })
      })
      return () => cancelAnimationFrame(frame)
    }
    let cancelled = false
    let loadedDocument: PDFDocumentProxy | null = null
    const loadingFrame = requestAnimationFrame(() => {
      setState({ status: 'loading', document: null, error: null })
    })
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'include' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const bytes = new Uint8Array(await response.arrayBuffer())
        const resources = getPdfJsCmapAndStandardFontUrls()
        loadedDocument = await getDocument({
          data: bytes,
          ...resources,
          cMapPacked: true,
          useSystemFonts: true,
          disableFontFace: false,
        }).promise
        if (cancelled) {
          await loadedDocument.destroy()
          return
        }
        setState({ status: 'ready', document: loadedDocument, error: null })
      } catch {
        if (!cancelled) {
          setState({
            status: 'error',
            document: null,
            error: 'PDF를 불러오지 못했습니다.',
          })
        }
      }
    })()
    return () => {
      cancelled = true
      cancelAnimationFrame(loadingFrame)
      if (loadedDocument) void loadedDocument.destroy()
    }
  }, [url])

  return state
}
