// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { BINDER_SOURCES_CHANGED, useBinderSourceRefresh } from './useBinderSourceRefresh'

it('refreshes mounted state readers on storage mutation and focus, and unsubscribes', async () => {
  const refresh = vi.fn(async () => {})
  function Reader() { useBinderSourceRefresh(refresh); return null }
  const host = document.createElement('div')
  const root = createRoot(host)
  await act(async () => { root.render(<Reader />) })
  window.dispatchEvent(new Event(BINDER_SOURCES_CHANGED))
  window.dispatchEvent(new Event('focus'))
  expect(refresh).toHaveBeenCalledTimes(2)
  await act(async () => { root.unmount() })
  window.dispatchEvent(new Event(BINDER_SOURCES_CHANGED))
  window.dispatchEvent(new Event('focus'))
  expect(refresh).toHaveBeenCalledTimes(2)
})
