/**
 * FK 생성 전 컬럼 타입 호환 여부를 확인한다.
 * users.id(text) ↔ integer *_by 컬럼 불일치로 initDb가 실패하는 것을 방지한다.
 */

export async function getColumnType(executor, tableName, columnName) {
  const { rows } = await executor.query(
    `
    SELECT data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    `,
    [tableName, columnName],
  )
  return rows[0] ?? null
}

export function normalizePgTypeName(typeInfo) {
  return String(typeInfo?.udt_name ?? typeInfo?.data_type ?? '').toLowerCase()
}

export function areFkColumnTypesCompatible(left, right) {
  if (!left || !right) {
    return false
  }
  const leftType = normalizePgTypeName(left)
  const rightType = normalizePgTypeName(right)
  if (!leftType || !rightType) {
    return false
  }
  if (leftType === rightType) {
    return true
  }

  const integerTypes = new Set(['int2', 'int4', 'int8', 'integer', 'bigint', 'smallint'])
  if (integerTypes.has(leftType) && integerTypes.has(rightType)) {
    return true
  }

  const textTypes = new Set(['text', 'varchar', 'bpchar', 'character varying'])
  if (textTypes.has(leftType) && textTypes.has(rightType)) {
    return true
  }

  return false
}

export async function hasTableConstraint(executor, tableName, constraintName) {
  const { rows } = await executor.query(
    `
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = $1
      AND constraint_name = $2
    LIMIT 1
    `,
    [tableName, constraintName],
  )
  return rows.length > 0
}

/**
 * users(id) 참조 FK를 타입이 호환될 때만 추가한다.
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
const INTEGER_UDT = new Set(['int2', 'int4', 'int8'])
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/

function assertSafeIdent(name) {
  if (!SAFE_IDENT.test(String(name))) {
    throw new Error(`unsafe identifier: ${name}`)
  }
}

async function getConstraintState(executor, tableName, constraintName) {
  const { rows } = await executor.query(
    `
    SELECT c.convalidated
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = $1 AND c.conname = $2
    LIMIT 1
    `,
    [tableName, constraintName],
  )
  return rows[0] ?? null
}

/**
 * users.id(text)를 참조해야 하는 *_by 컬럼이 레거시 INTEGER면 TEXT로 변환한다.
 * - 이미 text 계열이거나 users.id가 text가 아니면 no-op (재실행 안전)
 * - 비-NULL 값 중 users.id와 매칭되지 않는 값(orphan)이 있으면 변환하지 않고 경고만 남긴다 (데이터 보존)
 * - 하나의 트랜잭션 + lock_timeout. 실패 시 ROLLBACK, initDb는 계속 진행한다.
 */
export async function ensureUserIdColumnIsText(
  executor,
  { tableName, columnNames, lockTimeout = '5s', logPrefix = '[initDb][insurance-claim]' },
) {
  assertSafeIdent(tableName)
  columnNames.forEach(assertSafeIdent)

  const userIdType = normalizePgTypeName(await getColumnType(executor, 'users', 'id'))
  if (userIdType !== 'text' && userIdType !== 'varchar') {
    console.warn(`${logPrefix} skip ${tableName} *_by text conversion: users.id is ${userIdType || 'missing'}`)
    return { converted: [], skipped: 'users_id_not_text' }
  }

  const toConvert = []
  for (const columnName of columnNames) {
    const type = normalizePgTypeName(await getColumnType(executor, tableName, columnName))
    if (INTEGER_UDT.has(type)) {
      toConvert.push(columnName)
    }
  }
  if (toConvert.length === 0) {
    return { converted: [], skipped: null }
  }

  const client = typeof executor.connect === 'function' ? await executor.connect() : executor
  const release = client !== executor && typeof client.release === 'function' ? () => client.release() : () => {}
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL lock_timeout = '${lockTimeout.replace(/[^0-9a-z]/gi, '')}'`)
    for (const columnName of toConvert) {
      const { rows } = await client.query(
        `
        SELECT COUNT(*)::int AS orphan_count
        FROM ${tableName} r
        WHERE r.${columnName} IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.${columnName}::text)
        `,
      )
      const orphanCount = Number(rows[0]?.orphan_count ?? 0)
      if (orphanCount > 0) {
        await client.query('ROLLBACK')
        console.warn(`${logPrefix} abort ${tableName} *_by text conversion: ${columnName} has orphan values`, {
          orphanCount,
        })
        return { converted: [], skipped: 'orphans' }
      }
    }
    const alterParts = toConvert.map(
      (columnName) => `ALTER COLUMN ${columnName} TYPE TEXT USING ${columnName}::text`,
    )
    await client.query(`ALTER TABLE ${tableName} ${alterParts.join(', ')}`)
    await client.query('COMMIT')
    console.log(`${logPrefix} ${tableName} columns converted to TEXT`, toConvert)
    return { converted: toConvert, skipped: null }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    console.warn(`${logPrefix} ${tableName} *_by text conversion failed (unchanged)`, error?.message ?? error)
    return { converted: [], skipped: 'error' }
  } finally {
    release()
  }
}

export async function ensureOptionalUserForeignKey(
  executor,
  {
    tableName,
    columnName,
    constraintName,
    onDelete = 'SET NULL',
    validateSeparately = false,
    logPrefix = '[initDb][insurance-claim]',
  },
) {
  const state = await getConstraintState(executor, tableName, constraintName)
  if (state) {
    if (validateSeparately && state.convalidated === false) {
      try {
        await executor.query(`ALTER TABLE ${tableName} VALIDATE CONSTRAINT ${constraintName}`)
        console.log(`${logPrefix} validated ${constraintName}`)
      } catch (error) {
        console.warn(`${logPrefix} validate ${constraintName} failed (left NOT VALID)`, error?.message ?? error)
      }
    }
    return
  }

  const sourceType = await getColumnType(executor, tableName, columnName)
  const userIdType = await getColumnType(executor, 'users', 'id')
  if (!sourceType) {
    console.warn(`${logPrefix} skip ${constraintName}: source column missing`, {
      tableName,
      columnName,
    })
    return
  }

  if (!areFkColumnTypesCompatible(sourceType, userIdType)) {
    console.warn(`${logPrefix} skip ${constraintName}: incompatible column types`, {
      [columnName]: sourceType,
      users_id: userIdType,
    })
    return
  }

  try {
    await executor.query(
      `
      ALTER TABLE ${tableName}
      ADD CONSTRAINT ${constraintName}
      FOREIGN KEY (${columnName}) REFERENCES users(id) ON DELETE ${onDelete}${validateSeparately ? ' NOT VALID' : ''}
      `,
    )
    if (validateSeparately) {
      await executor.query(`ALTER TABLE ${tableName} VALIDATE CONSTRAINT ${constraintName}`)
    }
    console.log(`${logPrefix} created ${constraintName}`)
  } catch (error) {
    console.warn(`${logPrefix} skip ${constraintName}: add constraint failed`, error?.message ?? error)
  }
}
