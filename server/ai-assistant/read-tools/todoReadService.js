import { getKstDateString } from '../../../shared/dateTimeKst.js'
import { parseGaId } from '../../lib/parseGaId.js'
import { safeQuery } from '../../utils/dbSafeQuery.js'

function seoulWeekRangeYmd() {
  const today = getKstDateString(new Date())
  const dt = new Date(`${today}T12:00:00+09:00`)
  const day = dt.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(dt)
  start.setDate(dt.getDate() + mondayOffset)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: getKstDateString(start), end: getKstDateString(end) }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ due?: 'today' | 'tomorrow' | 'week' }} input
 */
export async function listTodosForAssistant(pool, req, input = {}) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = parseGaId(req.user?.gaId)
  if (!userId || gaId == null) {
    return { todos: [] }
  }

  const conditions = [`t.ga_id = $1`, `(t.owner_user_id = $2 OR t.assignee_user_id = $2)`, `t.status = 'pending'`]
  const params = [gaId, userId]
  let p = 3

  const due = input.due ?? 'today'
  if (due === 'today') {
    conditions.push(`t.due_date = $${p}`)
    params.push(getKstDateString(new Date()))
    p += 1
  } else if (due === 'tomorrow') {
    const t = getKstDateString(new Date())
    const dt = new Date(`${t}T12:00:00+09:00`)
    dt.setDate(dt.getDate() + 1)
    conditions.push(`t.due_date = $${p}`)
    params.push(getKstDateString(dt))
    p += 1
  } else if (due === 'week') {
    const { start, end } = seoulWeekRangeYmd()
    conditions.push(`t.due_date >= $${p} AND t.due_date <= $${p + 1}`)
    params.push(start, end)
    p += 2
  }

  const r = await safeQuery(
    pool,
    `
    SELECT t.id, t.title, t.due_date, t.status, t.source_type
    FROM todos t
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.due_date NULLS LAST, t.updated_at DESC
    LIMIT 30
    `,
    params,
  )

  return {
    due,
    todos: r.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? '').trim(),
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
      status: row.status ?? null,
      sourceType: row.source_type ?? null,
    })),
  }
}
