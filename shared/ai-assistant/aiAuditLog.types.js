/**
 * 향후 AI Tool 실행 감사 로그 확장용 타입(문서 SSOT).
 * Phase 0 에서는 저장소·API 미구현.
 *
 * @typedef {object} AiToolAuditLogEntry
 * @property {number} userId
 * @property {number|null} gaId
 * @property {string} sessionId
 * @property {string} command
 * @property {string} toolKey
 * @property {Record<string, unknown>} sanitizedArguments
 * @property {unknown} resultSummary
 * @property {string|null} affectedEntityType
 * @property {string|null} affectedEntityId
 * @property {Record<string, unknown>|null} beforeMetadata
 * @property {Record<string, unknown>|null} afterMetadata
 * @property {string} timestamp
 * @property {string|null} errorCode
 */

export const AI_AUDIT_FORBIDDEN_RAW_FIELDS = Object.freeze([
  'password',
  'oauth_token',
  'refresh_token',
  'api_key',
  'credential',
  'client_secret',
])
