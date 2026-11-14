// @vitest-environment jsdom
import { act, useState } from 'react'
import FormButton from '../../../../components/form/FormButton'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { SmsModuleViewProps } from '../../hooks/useSmsModuleState'
import type { SmsBulkRecipientState } from '../../hooks/useSmsBulkRecipientState'
import type { SmsCampaignPreview } from '../../types/sms.types'
import SmsBulkCartComposer from './SmsBulkCartComposer'

describe('cart campaign actions', () => {
  it('previews sendable cart IDs, invalidates changed text and saves a one-off reservation', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    const created = vi.fn()
    const previewed = vi.fn()
    function Harness() {
      const [bulkForm, setBulkForm] = useState({
        customerIdsText: 'old group',
        message: '안내 문자',
        senderNumber: '01012345678',
        messageType: 'info',
        title: '',
        scheduledAt: '2099-01-01T12:00',
      })
      const [preview, setPreview] = useState<SmsCampaignPreview | null>(null)
      const module = {
        bulkForm,
        setBulkForm,
        preview,
        previewAcknowledged: Boolean(preview),
        busy: false,
        settings: { realSendEnabled: true },
        templates: [],
        verifiedSenders: [],
        handlePreviewBulk: async () => {
          previewed(bulkForm.customerIdsText)
          setPreview({ sendableCount: 1, skippedCount: 0 } as SmsCampaignPreview)
        },
        handleCreateBulk: async (scheduled: boolean) => {
          created(scheduled, bulkForm)
        },
      } as unknown as SmsModuleViewProps
      const bulkState = {
        summary: { total: 2, sendable: 1, excluded: 1 },
        sendableCustomerIds: [42],
        groupActionBusy: false,
      } as unknown as SmsBulkRecipientState
      return (
        <>
          <SmsBulkCartComposer
            variant="mobile"
            module={module}
            bulkState={bulkState}
            adDisplayName="설계사"
          />
          <FormButton
            htmlType="button"
            onClick={() => setBulkForm((prev) => ({ ...prev, message: '변경된 문자' }))}
          >
            테스트 본문 변경
          </FormButton>
        </>
      )
    }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const button = (label: string) =>
      [...document.querySelectorAll('button')].find((el) => el.textContent === label)!
    try {
      await act(async () => root.render(<Harness />))
      expect(button('문자 발송').disabled).toBe(true)
      await act(async () => button('발송 미리보기').click())
      expect(previewed).toHaveBeenCalledWith('42')
      expect(button('문자 발송').disabled).toBe(false)
      await act(async () => button('문자 발송').click())
      const immediateDialog = document.querySelector('[role="dialog"]')!
      const immediateConfirm = [...immediateDialog.querySelectorAll('button')].find(
        (el) => el.textContent === '발송',
      )!
      await act(async () => immediateConfirm.click())
      expect(created).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ customerIdsText: '42' }),
      )
      created.mockClear()
      await act(async () => button('발송 미리보기').click())
      await act(async () => button('테스트 본문 변경').click())
      expect(button('문자 발송').disabled).toBe(true)
      const mode = [...host.querySelectorAll('select')].find((el) =>
        [...el.options].some((option) => option.value === 'reserved'),
      )!
      await act(async () => {
        mode.value = 'reserved'
        mode.dispatchEvent(new Event('change', { bubbles: true }))
      })
      await act(async () => button('예약 저장').click())
      expect(created).not.toHaveBeenCalled()
      const dialog = document.querySelector('[role="dialog"]')!
      const confirm = [...dialog.querySelectorAll('button')].find(
        (el) => el.textContent === '예약 저장',
      )!
      await act(async () => confirm.click())
      expect(created).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ customerIdsText: '42', scheduledAt: '2099-01-01T12:00' }),
      )
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })
})
