/**
 * 원수사 소식지 도메인 타입.
 * UI에는 보험사명 중심, 코드(insurerCode)는 내부 식별·스토리지 경로용.
 */

export type NewsletterPublishStatus = 'DRAFT' | 'PUBLISHED'

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed'

/** 보험사 요약 (GA 스코프 목록용) */
export interface InsurerSummary {
  /** 내부 코드 — 스토리지 경로 segment, UI 비노출 권장 */
  insurerCode: string
  insurerName: string
  /** URL 경로용 — 동일 이름이어도 GA 내에서 유일 */
  insurerSlug: string
  gaCode: string
  newsletterCount: number
  lastPublishedAt: string | null
}

/** 첨부 (이미지 / PDF) */
export interface NewsletterAttachment {
  id: string
  kind: 'image' | 'pdf'
  /** TODO(insurer-news): 실제 연결 후 서명 URL 또는 API 경로 */
  url: string
  fileName: string
  sortOrder: number
}

/** 목록·카드용 소식지 행 */
export interface NewsletterItem {
  id: string
  gaCode: string
  insurerCode: string
  insurerName: string
  insurerSlug: string
  title: string
  summary: string
  heroImageUrl: string | null
  publishedAt: string
  status: NewsletterPublishStatus
  hasImages: boolean
  hasPdf: boolean
  hasTextBody: boolean
}

/** 상세 본문 */
export interface NewsletterDetail extends NewsletterItem {
  bodyText: string
  attachments: NewsletterAttachment[]
}

/** 원수사 관리자 계정 (이메일 필드 없음) */
export interface InsurerManagerAccount {
  id: string
  gaCode: string
  insurerCode: string
  insurerName: string
  username: string
  /** 데모용 평문 비밀번호 — 실제 연결 시 제거 */
  passwordPlain: string
  status: 'ACTIVE' | 'DISABLED'
  lastLoginAt?: string
}

export interface InsurerNewsAdminSession {
  accountId: string
  gaCode: string
  insurerCode: string
  insurerName: string
  username: string
}

/** 업로드 큐 아이템 (폼 상태) */
export interface LocalAttachmentDraft {
  localId: string
  file: File
  kind: 'image' | 'pdf'
  previewUrl: string | null
  status: UploadStatus
  errorMessage?: string
  /** 기존 첨부 수정 시 서버 id — mock 단계에서는 선택 */
  existingAttachmentId?: string
}
