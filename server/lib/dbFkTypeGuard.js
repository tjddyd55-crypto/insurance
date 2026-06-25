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
export async function ensureOptionalUserForeignKey(
  executor,
  {
    tableName,
    columnName,
    constraintName,
    onDelete = 'SET NULL',
    logPrefix = '[initDb][insurance-claim]',
  },
) {
  const exists = await hasTableConstraint(executor, tableName, constraintName)
  if (exists) {
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
      FOREIGN KEY (${columnName}) REFERENCES users(id) ON DELETE ${onDelete}
      `,
    )
  } catch (error) {
    console.warn(`${logPrefix} skip ${constraintName}: add constraint failed`, error?.message ?? error)
  }
}
