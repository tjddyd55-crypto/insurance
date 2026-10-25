/**
 * users 의 접속 채널·기기·최근 접속(last_seen_at) 기록 — best-effort, throttle.
 *
 * 매 요청 DB write 를 하지 않는 근거:
 *   1) 프로세스 메모리 throttle: 같은 사용자·같은 컨텍스트(채널/기기/버전)는
 *      ACCESS_LAST_SEEN_THROTTLE_MS(15분) 안에 DB 를 아예 호출하지 않는다.
 *   2) 단일 UPDATE 의 WHERE 조건: last_seen_at 이 15분 이상 지났거나 컨텍스트가 바뀐 경우에만
 *      row 가 갱신된다(여러 인스턴스/재시작 시에도 15분 내 중복 write 없음).
 * first_client_type 은 비어 있을 때 1회만 채우고 덮어쓰지 않는다. 과거 데이터 backfill 없음.
 */
import { ACCESS_LAST_SEEN_THROTTLE_MS } from '../../shared/clientAccessContext.js'

const MEMORY_THROTTLE_MAX_ENTRIES = 50_000

/** @type {Map<string, { at: number, sig: string }>} */
const memoryThrottle = new Map()

export function resetUserAccessContextThrottleForTests() {
  memoryThrottle.clear()
}

function contextSignature(ctx) {
  return [ctx?.clientType ?? '', ctx?.deviceModel ?? '', ctx?.appVersion ?? ''].join('|')
}

export const RECORD_USER_ACCESS_CONTEXT_SQL = `
    UPDATE users
    SET first_client_type = COALESCE(first_client_type, $2::text),
        last_client_type = COALESCE($2::text, last_client_type),
        last_device_model = CASE WHEN $2::text IS NULL THEN last_device_model ELSE $3::text END,
        last_app_version = CASE WHEN $2::text IS NULL THEN last_app_version ELSE $4::text END,
        last_seen_at = NOW()
    WHERE id = $1
      AND (
        $5::boolean
        OR last_seen_at IS NULL
        OR last_seen_at < NOW() - ($6::text || ' milliseconds')::interval
        OR (first_client_type IS NULL AND $2::text IS NOT NULL)
        OR (
          $2::text IS NOT NULL
          AND (
            last_client_type IS DISTINCT FROM $2::text
            OR last_device_model IS DISTINCT FROM $3::text
            OR last_app_version IS DISTINCT FROM $4::text
          )
        )
      )
    `

/**
 * @param {{ query: Function }} pool
 * @param {string} userId 인증된 사용자 id (로그인 실패/비인증 요청에서는 호출 금지)
 * @param {{ clientType: string|null, deviceModel: string|null, appVersion: string|null }} ctx
 * @param {{ force?: boolean, nowMs?: number }} [options] force=true: 로그인 성공 등 throttle 무시
 * @returns {Promise<{ status: 'skipped_memory' | 'written' | 'not_written' | 'skipped_invalid' | 'error' }>}
 */
export async function recordUserAccessContext(pool, userId, ctx, options = {}) {
  const uid = String(userId ?? '').trim()
  if (!uid || !pool) return { status: 'skipped_invalid' }
  const nowMs = options.nowMs ?? Date.now()
  const force = options.force === true
  const sig = contextSignature(ctx)
  const prev = memoryThrottle.get(uid)
  if (!force && prev && prev.sig === sig && nowMs - prev.at < ACCESS_LAST_SEEN_THROTTLE_MS) {
    return { status: 'skipped_memory' }
  }
  if (memoryThrottle.size >= MEMORY_THROTTLE_MAX_ENTRIES) memoryThrottle.clear()
  memoryThrottle.set(uid, { at: nowMs, sig })
  try {
    const r = await pool.query(RECORD_USER_ACCESS_CONTEXT_SQL, [
      uid,
      ctx?.clientType ?? null,
      ctx?.deviceModel ?? null,
      ctx?.appVersion ?? null,
      force,
      String(ACCESS_LAST_SEEN_THROTTLE_MS),
    ])
    return { status: Number(r?.rowCount ?? 0) > 0 ? 'written' : 'not_written' }
  } catch (e) {
    /* 메모리 entry 유지: 오류 시에도 15분간 재시도하지 않아 요청마다 DB 를 치지 않는다 */
    console.error('[userAccessContext] record failed', e?.message ?? e)
    return { status: 'error' }
  }
}
