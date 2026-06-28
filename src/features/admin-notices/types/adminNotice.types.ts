export type AdminNoticeStatus = 'draft' | 'published' | 'archived'

export type AdminNoticeTextBlock = {
  type: 'text'
  text: string
}

export type AdminNoticeImageBlock = {
  type: 'image'
  url: string
  storageKey: string
  alt?: string
}

export type AdminNoticeContentBlock = AdminNoticeTextBlock | AdminNoticeImageBlock

export type AdminNotice = {
  id: number
  title: string
  contentHtml: string
  contentBlocks?: AdminNoticeContentBlock[]
  plainText?: string | null
  status: AdminNoticeStatus
  showAsPopup: boolean
  popupPriority: number
  startsAt?: string | null
  endsAt?: string | null
  createdBy?: string | null
  updatedBy?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type ActivePopupNotice = {
  id: number
  title: string
  contentHtml: string
}

export type AdminNoticeFormState = {
  title: string
  contentHtml: string
  status: AdminNoticeStatus
  showAsPopup: boolean
  popupPriority: number
  startsAt: string
  endsAt: string
}

export const emptyAdminNoticeForm = (): AdminNoticeFormState => ({
  title: '',
  contentHtml: '<p></p>',
  status: 'draft',
  showAsPopup: false,
  popupPriority: 0,
  startsAt: '',
  endsAt: '',
})

export function adminNoticeToForm(notice: AdminNotice): AdminNoticeFormState {
  return {
    title: notice.title,
    contentHtml: notice.contentHtml?.trim() ? notice.contentHtml : '<p></p>',
    status: notice.status,
    showAsPopup: notice.showAsPopup,
    popupPriority: notice.popupPriority,
    startsAt: notice.startsAt ? notice.startsAt.slice(0, 16) : '',
    endsAt: notice.endsAt ? notice.endsAt.slice(0, 16) : '',
  }
}
