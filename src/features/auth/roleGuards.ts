import type { UserRole } from './authApi'

/** 원수사 연락처·회사 마스터 편집·조회에서 스태프로 취급하는 역할 */
export const INSURANCE_OPS_ROLES: UserRole[] = ['GA_ADMIN', 'GA_STAFF', 'SUPER_ADMIN']

export function isInsuranceOpsRole(role: string | undefined): role is UserRole {
  return role != null && (INSURANCE_OPS_ROLES as readonly string[]).includes(role)
}

/** PDF 좌표 템플릿 관리 — GA 테넌트 관리자·스태프 + 플랫폼 관리자 */
export const PDF_TEMPLATE_ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'GA_ADMIN', 'GA_STAFF']

export function canUsePdfTemplateAdminRoutes(role: string | undefined): boolean {
  return role != null && (PDF_TEMPLATE_ADMIN_ROLES as readonly string[]).includes(role)
}

/** 보험청구 보험회사 설정 — PDF 템플릿 관리와 동일 관리자 역할 (서버 API용) */
export const INSURANCE_CLAIM_ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'GA_ADMIN', 'GA_STAFF']

export function canUseInsuranceClaimAdminRoutes(role: string | undefined): boolean {
  return role != null && (INSURANCE_CLAIM_ADMIN_ROLES as readonly string[]).includes(role)
}

/** 보험청구·청구관리 사용자 화면 — 일반 설계사(USER) 전용 */
export function canUseInsuranceClaimUserRoutes(role: string | undefined): boolean {
  return role === 'USER'
}

/**
 * 소식지·게시판 관리(추가/수정/삭제·작성자 관리) — SUPER_ADMIN · GA_ADMIN 만.
 * GA_STAFF 는 서버/UI 모두 관리 화면 미노출 (작성자 API 도 GA_ADMIN 전용과 일치).
 */
export const NEWSLETTER_BOARD_ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'GA_ADMIN']

export function canUseNewsletterBoardAdminRoutes(role: string | undefined): boolean {
  return role != null && (NEWSLETTER_BOARD_ADMIN_ROLES as readonly string[]).includes(role)
}

/** GA 게시판 작성자 계정 관리 — 소식지 게시판 관리와 동일 역할 */
export function canManageGaBoardWriters(role: string | undefined): boolean {
  return canUseNewsletterBoardAdminRoutes(role)
}

/** GA전용 동적 소식지 업로드 메뉴(작성자 워크스페이스 진입) — 내부 운영 역할만 */
export const GA_NEWSLETTER_BOARD_UPLOAD_MENU_ROLES: UserRole[] = ['GA_ADMIN', 'GA_STAFF']

export function canAccessGaNewsletterBoardUploadMenu(role: string | undefined): boolean {
  return role != null && (GA_NEWSLETTER_BOARD_UPLOAD_MENU_ROLES as readonly string[]).includes(role)
}

export function isGaAdminRole(role: string | undefined): boolean {
  return role === 'GA_ADMIN'
}

/**
 * 일반 설계사(USER) CRM 업무 워크스페이스.
 * GA_ADMIN 은 관리 메뉴만 쓰므로 이 영역에 들어가지 않는다.
 */
export function canAccessUserCrmWorkspace(role: string | undefined): boolean {
  return role === 'USER'
}

/**
 * GA_ADMIN 전용 관리 셸 허용 여부(메뉴·랜딩·직접 URL 가드 공용).
 * SUPER_ADMIN 은 별도 전체 관리 메뉴를 쓰므로 여기 포함하지 않는다.
 */
export function canAccessGaAdminManagementShell(role: string | undefined): boolean {
  return role === 'GA_ADMIN'
}

/** 동의서 템플릿 관리(등록/수정) — GA_STAFF 제외 */
export const CONSENT_TEMPLATE_ADMIN_ROLES: UserRole[] = ['GA_ADMIN', 'SUPER_ADMIN']

export function canUseConsentTemplateAdminRoutes(role: string | undefined): boolean {
  return role != null && (CONSENT_TEMPLATE_ADMIN_ROLES as readonly string[]).includes(role)
}

/** @deprecated 내부 동의서 관리 경로 전용 — canUseConsentTemplateAdminRoutes 사용 */
export const STAFF_ROUTE_ROLES = CONSENT_TEMPLATE_ADMIN_ROLES

export function canUseStaffRoutes(role: string | undefined): boolean {
  return canUseConsentTemplateAdminRoutes(role)
}

export function isInsurerManagerRole(role: string | undefined): role is UserRole {
  return role === 'INSURER_MANAGER'
}

export function isLossAdjusterRole(role: string | undefined): role is UserRole {
  return role === 'LOSS_ADJUSTER'
}

export function isNewsManagerRole(role: string | undefined): role is UserRole {
  return role === 'INSURER_MANAGER' || role === 'LOSS_ADJUSTER'
}

/** 원수사·손해사정사 전용 계정(설계사 사이트 메뉴 비노출) */
export function isSpecialNewsletterAccount(role: string | undefined): boolean {
  return isNewsManagerRole(role)
}

/** 원수사 연락처·일반화재·담당자 등 서버에서 GA_ADMIN·GA_STAFF·SUPER_ADMIN 쓰기 허용 */
export function canMutateInsuranceDirectory(role: string | undefined): boolean {
  return role === 'GA_ADMIN' || role === 'GA_STAFF' || role === 'SUPER_ADMIN'
}

export function isGaStaffReadOnlyUi(role: string | undefined): boolean {
  return role === 'GA_STAFF'
}

/** 감사 로그 조회: SUPER_ADMIN · GA_ADMIN */
export function canReadSecurityAuditLogs(role: string | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'GA_ADMIN'
}

/** 대시보드에서 원수사 안내 문구(일반 GA 소속 담당자) */
export function isGaTenantStaffRole(role: string | undefined): boolean {
  return role === 'GA_ADMIN' || role === 'GA_STAFF'
}
