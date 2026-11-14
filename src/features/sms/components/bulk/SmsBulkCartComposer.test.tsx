import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SmsModuleViewProps } from '../../hooks/useSmsModuleState'
import type { SmsBulkRecipientState } from '../../hooks/useSmsBulkRecipientState'
import SmsBulkCartComposer from './SmsBulkCartComposer'

function renderCart(total: number, sendable: number, realSendEnabled = true) {
  const handleCreateBulk = vi.fn()
  const module = {
    bulkForm: {
      customerIdsText: sendable ? '42' : '',
      message: '안녕하세요',
      senderNumber: '01012345678',
      messageType: 'info',
      title: '',
      scheduledAt: '',
    },
    setBulkForm: vi.fn(),
    settings: { realSendEnabled },
    templates: [],
    verifiedSenders: [],
    busy: false,
    // A preview left over from another tab must never authorize this cart.
    previewAcknowledged: true,
    preview: { sendableCount: 99, skippedCount: 0 },
    handleCreateBulk,
  } as unknown as SmsModuleViewProps
  const bulkState = {
    summary: { total, sendable, excluded: total - sendable },
    sendableCustomerIds: sendable ? [42] : [],
    groupActionBusy: false,
  } as unknown as SmsBulkRecipientState
  return {
    html: renderToStaticMarkup(
      <SmsBulkCartComposer
        variant="pc"
        module={module}
        bulkState={bulkState}
        adDisplayName="설계사"
      />,
    ),
    handleCreateBulk,
  }
}

describe('cart campaign composer', () => {
  it('disables sending and explains how to start when the cart is empty', () => {
    const { html, handleCreateBulk } = renderCart(0, 0)
    expect(html).toContain('발송 대상을 먼저 선택해주세요.')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>문자 발송<\/button>/)
    expect(handleCreateBulk).not.toHaveBeenCalled()
  })

  it('uses cart counts, offers one-off reservation and never requires another group', () => {
    const { html } = renderCart(3, 1)
    expect(html).toContain('발송 대상 3명 / 발송 가능 1명 / 제외 2명')
    expect(html).toContain('예약발송')
    expect(html).not.toContain('그룹 선택')
    expect(html).not.toContain('99건')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>문자 발송<\/button>/)
  })

  it('keeps real-send-disabled messaging and blocks sends for excluded-only carts', () => {
    const { html } = renderCart(2, 0, false)
    expect(html).toContain('실발송 비활성 상태입니다.')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>문자 발송<\/button>/)
    expect(html).not.toContain('발송 대상을 먼저 선택해주세요.')
  })
})
