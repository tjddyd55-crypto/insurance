export type PersonalMessageSendGateInput = {
  targetCustomerId?: number | null
  message: string
  attachmentCount: number
  isEditing: boolean
  actionBusy?: boolean
  deletingId?: string | null
}

/**
 * PC ClaimRequestsPersonalPCStandalone 발송 버튼과 동일 정책.
 * draft 첨부 pending 여부는 버튼 disabled에 쓰지 않고, 발송 클릭 시 업로드한다.
 */
export function isPersonalMessageSendDisabled(input: PersonalMessageSendGateInput): boolean {
  const {
    targetCustomerId,
    message,
    attachmentCount,
    isEditing,
    actionBusy = false,
    deletingId = null,
  } = input

  if (!targetCustomerId || actionBusy) {
    return true
  }
  if (deletingId != null && deletingId !== '') {
    return true
  }
  if (isEditing) {
    return !message.trim()
  }
  return !message.trim() && attachmentCount === 0
}
