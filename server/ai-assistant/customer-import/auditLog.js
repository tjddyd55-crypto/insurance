/**
 * AI Tool 실행 감사 (민감정보 최소화).
 * @param {object} entry
 */
export function logCustomerImportToolAudit(entry) {
  console.info('[ai-customer-import]', {
    toolKey: entry.toolKey,
    userId: entry.userId,
    gaId: entry.gaId,
    importSessionId: entry.importSessionId,
    rowCounts: entry.rowCounts ?? null,
    status: entry.status,
    errorCode: entry.errorCode ?? null,
    durationMs: entry.durationMs ?? null,
  })
}
