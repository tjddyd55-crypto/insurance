/** LENIENT_DB_RESPONSES=1 일 때 handleDbError 가 돌려주는 envelope 등 */
export function isLenientFailurePayload(v: unknown): v is { success: false } {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    'success' in v &&
    (v as { success?: unknown }).success === false
  )
}
