/** SQL 자리표시자. 인덱스(0-based)와 $n 이 어긋나지 않게 한곳에서 만든다. */
const ph = (index) => `$${index + 1}`

export const CALENDAR_ITEM_SELECT = `
  i.id,
  i.ga_id,
  i.owner_user_id,
  i.item_type,
  i.title,
  i.description,
  i.all_day,
  i.start_at,
  i.end_at,
  to_char(i.start_date, 'YYYY-MM-DD') AS start_date,
  to_char(i.end_date, 'YYYY-MM-DD') AS end_date,
  i.timezone,
  i.recurrence,
  i.customer_id,
  i.location,
  i.color,
  i.status,
  i.origin,
  i.version,
  i.request_id,
  i.deleted_at,
  i.created_at,
  i.updated_at,
  o.id AS outbox_id,
  o.op AS outbox_op,
  o.last_error_class
`

const OUTBOX_JOIN = `
  LEFT JOIN sync_outbox o
    ON o.owner_user_id = i.owner_user_id
   AND o.provider = 'google_calendar'
   AND o.local_type = 'calendar_item'
   AND o.local_id = i.id::text
`

export const FIND_OWNED_SQL = `
  SELECT ${CALENDAR_ITEM_SELECT}
  FROM calendar_items i
  ${OUTBOX_JOIN}
  WHERE i.id = ${ph(0)}::uuid
    AND i.owner_user_id = ${ph(1)}
    AND i.ga_id = ${ph(2)}
    AND i.deleted_at IS NULL
    AND i.item_type = 'schedule'
`

export const FIND_OWNED_ANY_SQL = `
  SELECT ${CALENDAR_ITEM_SELECT}
  FROM calendar_items i
  ${OUTBOX_JOIN}
  WHERE i.id = ${ph(0)}::uuid
    AND i.owner_user_id = ${ph(1)}
    AND i.ga_id = ${ph(2)}
    AND i.item_type = 'schedule'
`

export const FIND_BY_REQUEST_SQL = `
  SELECT ${CALENDAR_ITEM_SELECT}
  FROM calendar_items i
  ${OUTBOX_JOIN}
  WHERE i.owner_user_id = ${ph(0)}
    AND i.ga_id = ${ph(1)}
    AND i.request_id = ${ph(2)}
    AND i.item_type = 'schedule'
`

export const INSERT_SQL = `
  INSERT INTO calendar_items (
    ga_id, owner_type, owner_id, owner_user_id, created_by, assigned_to,
    item_type, title, description, all_day,
    start_at, end_at, start_date, end_date,
    timezone, recurrence, customer_id, location, color,
    status, origin, version, request_id,
    visibility, priority, sort_order
  ) VALUES (
    ${ph(0)}, 'user', ${ph(1)}, ${ph(1)}, ${ph(1)}, ${ph(1)},
    'schedule', ${ph(2)}, ${ph(3)}, ${ph(4)},
    ${ph(5)}, ${ph(6)}, ${ph(7)}, ${ph(8)},
    ${ph(9)}, ${ph(10)}::jsonb, ${ph(11)}, ${ph(12)}, ${ph(13)},
    ${ph(14)}, 'onefc', 1, ${ph(15)},
    'private', 'normal', 0
  )
  RETURNING id, version
`

export const UPDATE_SQL = `
  UPDATE calendar_items
  SET
    title = ${ph(0)},
    description = ${ph(1)},
    all_day = ${ph(2)},
    start_at = ${ph(3)},
    end_at = ${ph(4)},
    start_date = ${ph(5)},
    end_date = ${ph(6)},
    timezone = ${ph(7)},
    recurrence = ${ph(8)}::jsonb,
    customer_id = ${ph(9)},
    location = ${ph(10)},
    color = ${ph(11)},
    status = ${ph(12)},
    version = version + 1,
    updated_at = NOW()
  WHERE id = ${ph(13)}::uuid
    AND owner_user_id = ${ph(14)}
    AND ga_id = ${ph(15)}
    AND deleted_at IS NULL
    AND item_type = 'schedule'
  RETURNING id, version
`

export const SOFT_DELETE_SQL = `
  UPDATE calendar_items
  SET
    deleted_at = NOW(),
    status = 'cancelled',
    version = version + 1,
    updated_at = NOW()
  WHERE id = ${ph(0)}::uuid
    AND owner_user_id = ${ph(1)}
    AND ga_id = ${ph(2)}
    AND deleted_at IS NULL
    AND item_type = 'schedule'
  RETURNING id, version
`

export const LIST_SQL = `
  SELECT ${CALENDAR_ITEM_SELECT}
  FROM calendar_items i
  ${OUTBOX_JOIN}
  WHERE i.owner_user_id = ${ph(0)}
    AND i.ga_id = ${ph(1)}
    AND i.deleted_at IS NULL
    AND i.item_type = 'schedule'
    AND (
      (
        i.all_day IS TRUE
        AND i.start_date <= ${ph(3)}::date
        AND COALESCE(i.end_date, i.start_date + 1) > ${ph(2)}::date
      )
      OR
      (
        i.all_day IS NOT TRUE
        AND i.start_at < ${ph(5)}::timestamptz
        AND COALESCE(i.end_at, i.start_at + interval '1 second') > ${ph(4)}::timestamptz
      )
    )
  ORDER BY COALESCE(to_char(i.start_date, 'YYYY-MM-DD'), i.start_at::text), i.title, i.id
  LIMIT 500
`

export const ENQUEUE_OUTBOX_SQL = `
  INSERT INTO sync_outbox (
    owner_user_id, provider, local_type, local_id, op, local_version,
    attempts, next_attempt_at, created_at, updated_at
  ) VALUES (
    ${ph(0)}, 'google_calendar', 'calendar_item', ${ph(1)}, ${ph(2)}, ${ph(3)},
    0, NOW(), NOW(), NOW()
  )
  ON CONFLICT (owner_user_id, provider, local_type, local_id)
  DO UPDATE SET
    op = EXCLUDED.op,
    local_version = EXCLUDED.local_version,
    attempts = 0,
    next_attempt_at = NOW(),
    last_error_class = NULL,
    last_error = NULL,
    updated_at = NOW()
  WHERE sync_outbox.local_version <= EXCLUDED.local_version
  RETURNING id, op, local_version
`

/** 오류 본문은 저장하지 않는다. 분류 코드만. */
export const MARK_OUTBOX_ERROR_SQL = `
  UPDATE sync_outbox
  SET last_error_class = ${ph(0)},
      updated_at = NOW()
  WHERE owner_user_id = ${ph(1)}
    AND provider = 'google_calendar'
    AND local_type = 'calendar_item'
    AND local_id = ${ph(2)}
`

export const OWNED_SQL = Object.freeze([
  FIND_OWNED_SQL,
  FIND_OWNED_ANY_SQL,
  FIND_BY_REQUEST_SQL,
  INSERT_SQL,
  UPDATE_SQL,
  SOFT_DELETE_SQL,
  LIST_SQL,
  ENQUEUE_OUTBOX_SQL,
  MARK_OUTBOX_ERROR_SQL,
])
