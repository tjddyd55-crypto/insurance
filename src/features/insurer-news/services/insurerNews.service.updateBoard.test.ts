import { describe, expect, it } from 'vitest'
import { updateNewsletterBoard } from '../services/insurerNews.service'

describe('updateNewsletterBoard path selection', () => {
  it('uses ga-admin path for GA roles', async () => {
    const original = globalThis.fetch
    let capturedUrl = ''
    globalThis.fetch = async (input: RequestInfo | URL) => {
      capturedUrl = String(input)
      return new Response(JSON.stringify({ id: 'b1', slug: 'test', label: 'Test' }), { status: 200 })
    }
    try {
      await updateNewsletterBoard('token', 'b1', { label: 'Test' }, { role: 'GA_ADMIN' })
      expect(capturedUrl).toContain('/ga-admin/newsletter-boards/b1')
    } finally {
      globalThis.fetch = original
    }
  })

  it('uses admin path for super admin', async () => {
    const original = globalThis.fetch
    let capturedUrl = ''
    globalThis.fetch = async (input: RequestInfo | URL) => {
      capturedUrl = String(input)
      return new Response(JSON.stringify({ id: 'b1', slug: 'test', label: 'Test' }), { status: 200 })
    }
    try {
      await updateNewsletterBoard('token', 'b1', { label: 'Test' }, { role: 'SUPER_ADMIN' })
      expect(capturedUrl).toContain('/admin/newsletter-boards/b1')
    } finally {
      globalThis.fetch = original
    }
  })
})
